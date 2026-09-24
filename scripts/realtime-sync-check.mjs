#!/usr/bin/env node
/**
 * Multi-device realtime sync check — the proof that an edit on ONE device
 * (web / desktop app / mobile app) appears on the others immediately.
 *
 * The three clients are three independent browser contexts: the Tauri desktop
 * shell and the Capacitor mobile shell load exactly this same origin, so three
 * contexts exercise the same code paths as the three platforms (with the extra
 * benefit of being able to measure latency in-process).
 *
 * Usage:
 *   node scripts/realtime-sync-check.mjs                 # http://127.0.0.1:8080
 *   node scripts/realtime-sync-check.mjs http://127.0.0.1:8081
 *
 * The admin password comes from ADMIN_PASSWORD (or .env) and is only used to
 * sign in — writes are still authorised server-side by the session cookie.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const BUDGET_MS = Number(process.env.SYNC_BUDGET_MS || 1500);

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD.trim();
  const envFile = join(ROOT, ".env");
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("ADMIN_PASSWORD="));
    if (line) return line.slice("ADMIN_PASSWORD=".length).trim().replace(/^"|"$/g, "");
  }
  return "";
}

const DEVICES = [
  { name: "web", viewport: { width: 1440, height: 1000 } },
  { name: "desktop-app", viewport: { width: 1280, height: 900 } },
  { name: "mobile-app", viewport: { width: 390, height: 844 } },
];

const results = [];
/** Reuse an already-installed browser when the pinned Playwright build is absent. */
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "";

async function main() {
  const password = adminPassword();
  if (!password) {
    console.error("ADMIN_PASSWORD is required (set it in .env or the environment).");
    process.exit(2);
  }

  const browser = await chromium.launch(
    CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  );
  const clients = new Map();

  for (const device of DEVICES) {
    const context = await browser.newContext({ viewport: device.viewport });
    const page = await context.newPage();
    const loads = { count: 0 };
    const errors = [];
    page.on("load", () => {
      loads.count += 1;
    });
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 160)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 160));
    });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    clients.set(device.name, { context, page, device, loads, errors });
  }

  // 1) Everyone hydrates and the push channel comes up.
  for (const [name, client] of clients) {
    const live = await waitFor(
      client.page,
      async () => {
        const state = await pageState(client.page);
        return state.hydrated && state.sync === "live" ? state : null;
      },
      15_000,
    );
    results.push({
      step: `connect:${name}`,
      ok: Boolean(live),
      detail: live ? `hydrated, sync=${live.sync}, revision=${live.revision}` : "no live channel",
    });
  }

  // 2) Two managers sign in (web + desktop); mobile stays a viewer, since read
  //    sync must work for staff devices too.
  for (const name of ["web", "desktop-app"]) {
    const client = clients.get(name);
    const login = await client.page.evaluate(async (pw) => {
      const api = await import("/src/lib/auth/admin-api.ts");
      const store = await import("/src/lib/store.ts");
      const res = await api.adminLogin({ data: { password: pw } });
      await store.usePerfStore.getState().syncRole();
      return { ok: res.ok, role: store.usePerfStore.getState().role };
    }, password);
    results.push({
      step: `signin:${name}`,
      ok: login.ok && login.role === "manager",
      detail: JSON.stringify(login),
    });
  }

  // 3) web -> everyone else.
  await checkPropagation({
    clients,
    from: "web",
    to: ["desktop-app", "mobile-app"],
    value: 910_001,
    label: "web",
  });

  // 4) mobile -> everyone else (a write from the phone must reach the others).
  await signIn(clients.get("mobile-app"), password);
  await checkPropagation({
    clients,
    from: "mobile-app",
    to: ["web", "desktop-app"],
    value: 910_002,
    label: "mobile",
  });

  // 5) No client may have reloaded to get the new data.
  for (const [name, client] of clients) {
    results.push({
      step: `no-reload:${name}`,
      ok: client.loads.count <= 1,
      detail: `pageLoads=${client.loads.count}, consoleErrors=${client.errors.length}`,
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    JSON.stringify({ base: BASE, budgetMs: BUDGET_MS, results, failed: failed.length }, null, 2),
  );
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}


async function signIn(client, password) {
  const login = await client.page.evaluate(async (pw) => {
    const api = await import("/src/lib/auth/admin-api.ts");
    const store = await import("/src/lib/store.ts");
    const res = await api.adminLogin({ data: { password: pw } });
    await store.usePerfStore.getState().syncRole();
    return { ok: res.ok, role: store.usePerfStore.getState().role };
  }, password);
  results.push({
    step: `signin:${client.device.name}`,
    ok: login.ok,
    detail: JSON.stringify(login),
  });
}

/** Write a value on one client and time how long the others take to show it. */
async function checkPropagation({ clients, from, to, value, label }) {
  const writer = clients.get(from);
  const writtenAt = await writer.page.evaluate(async (v) => {
    const store = await import("/src/lib/store.ts");
    const at = Date.now();
    // Exactly the code path a manager's edit uses: optimistic update plus the
    // debounced shared save (which now publishes on the realtime channel).
    store.usePerfStore.getState().setValue("TV", "Gross", "result", v);
    return at;
  }, value);

  const timings = await Promise.all(
    to.map(async (name) => {
      const client = clients.get(name);
      const elapsed = await waitForValue(client.page, value, BUDGET_MS + 6000);
      const ms = elapsed < 0 ? -1 : Date.now() - writtenAt;
      return { to: name, ms };
    }),
  );

  for (const t of timings) {
    results.push({
      step: `sync:${label}→${t.to}`,
      ok: t.ms >= 0 && t.ms < BUDGET_MS,
      detail: t.ms < 0 ? "value never arrived" : `${t.ms}ms`,
    });
  }
}

async function pageState(page) {
  return page.evaluate(async () => {
    const store = await import("/src/lib/store.ts");
    const status = await import("/src/lib/realtime/status.ts");
    const s = store.usePerfStore.getState();
    return {
      hydrated: Boolean(s.hydrated),
      sync: status.useSyncStatus.getState().status,
      revision: s.revision ?? 0,
    };
  });
}

async function waitFor(page, fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(50);
  }
}

/** Resolve with the client-side wait time until the cell shows `value`. */
async function waitForValue(page, value, timeoutMs) {
  return page.evaluate(
    async ({ expected, timeout }) => {
      const store = await import("/src/lib/store.ts");
      const started = Date.now();
      for (;;) {
        const s = store.usePerfStore.getState();
        if (s.data?.[s.period]?.TV?.Gross?.result === expected) return Date.now() - started;
        if (Date.now() - started > timeout) return -1;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    },
    { expected: value, timeout: timeoutMs },
  );
}

main().catch((err) => {
  console.error("realtime-sync-check failed:", err);
  process.exit(1);
});

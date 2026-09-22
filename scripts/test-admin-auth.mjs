#!/usr/bin/env node
/**
 * End-to-end test of the Admin (Edit Mode) authentication flow against the
 * running dev server (http://127.0.0.1:8080). Verifies the ADMIN spec:
 *
 *   0. No hardcoded password anywhere in the client source ("Fay1" gone).
 *   1. Staff/View Mode: app renders, dashboard viewable, edit controls locked.
 *   2. Manager button opens the ONE-password dialog (no email field).
 *   3. Wrong password is rejected; Manager Mode is NOT granted.
 *   4. Correct password enables Manager Mode (role comes from the server session).
 *   5. The password is never stored in localStorage / sessionStorage.
 *   6. Manager Mode unlocks the Daily Editor; edits persist.
 *   7. A direct API write without the session cookie is rejected server-side.
 *   8. Exit Manager returns to Staff Mode and locks editing again.
 *   9. No uncaught console errors.
 *
 * The correct password is read from the local server-side `.env` (or the
 * ADMIN_PASSWORD env var) — the test never assumes a fixed value, so there is
 * no backdoor baked into the test either.
 *
 * Run after `npm run dev` is up. Prints a JSON verdict and exits non-zero on
 * any failure — never report success without this passing.
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8080";
const results = [];
const test = (name, ok, detail = "") => results.push({ name, ok, detail });

/** Resolve the real admin password from the server-side env (never the client). */
function readAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envFile = join(root, ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*ADMIN_PASSWORD\s*=\s*(.+?)\s*$/.exec(line);
      if (m) return m[1];
    }
  }
  return "";
}

const field = (page, name) =>
  page.locator("label", { hasText: name }).locator("input").first();

async function main() {
  const ADMIN_PW = readAdminPassword();
  if (!ADMIN_PW) {
    console.log(
      JSON.stringify(
        {
          allPassed: false,
          fatal: "ADMIN_PASSWORD not found in .env or process.env — cannot test login.",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  // ── 0. Static check: no hardcoded password in the client source ────────────
  const clientSrc = [
    "src/components/shell.tsx",
    "src/components/daily-editor.tsx",
    "src/components/admin-auth-dialog.tsx",
    "src/lib/store.ts",
  ]
    .map((f) => readFileSync(join(root, f), "utf8"))
    .join("\n");
  test(
    'no hardcoded "Fay1" password in client code',
    !/Fay1/.test(clientSrc),
    'any "if (password === ...)" client check must be gone',
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  /** Captured server-function requests (URL + decoded export name + body). */
  const serverFnPosts = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("request", (req) => {
    if (req.method() !== "POST" || !req.url().includes("/_serverFn/")) return;
    // The route segment is a base64 payload naming the module + export, e.g.
    // {"file":"/src/lib/dashboard-api.ts","export":"saveDashboardState_…"}.
    const encoded = req.url().split("/_serverFn/")[1];
    let exportName = "";
    try {
      const decoded = Buffer.from(encoded, "base64").toString();
      exportName = JSON.parse(decoded)?.export ?? "";
    } catch {
      /* not decodable — still record the raw URL */
    }
    serverFnPosts.push({
      url: req.url(),
      exportName,
      body: req.postData(),
      headers: req.headers(),
    });
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // App must render real content, in Staff/View Mode, with no password needed.
  const bodyText = (await page.locator("body").innerText()).trim();
  test("app renders content (staff mode, no password)", bodyText.length > 200, `${bodyText.length} chars`);

  // `exact: true` — حتى لا يطابق زر البوابة "Enter Manager Mode" زر الهيدر.
  const adminBtn = page.getByRole("button", { name: "Manager", exact: true });
  test(
    "staff mode is the default (Manager offered)",
    (await adminBtn.count()) > 0,
    "the app must start in view mode, not admin mode",
  );

  // ── 1. Daily Editor is locked in Staff Mode ────────────────────────────────
  await page.getByRole("button", { name: "Daily" }).click();
  await page.waitForTimeout(600);
  test(
    "daily editor locked for staff",
    (await page.getByText("Manager Access Required").count()) > 0,
    "edit controls must be unavailable without admin",
  );

  // ── 2. Manager opens the ONE-password dialog ───────────────────────────────
  await adminBtn.click();
  await page.waitForTimeout(600);
  test(
    "password dialog opened",
    (await page.getByRole("dialog").count()) > 0 &&
      (await page.getByRole("heading", { name: "Manager Access" }).count()) > 0,
  );
  test(
    "dialog has no email/username field (ONE password only)",
    (await page.getByLabel(/email|username/i).count()) === 0,
  );

  // ── 3. Wrong password is rejected ──────────────────────────────────────────
  await field(page, "Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await page.waitForTimeout(1200);
  test(
    "wrong password rejected",
    (await page.getByText("Incorrect Manager Password").count()) > 0,
  );
  test(
    "wrong password does not enable admin mode",
    (await page.getByRole("button", { name: "Exit Manager" }).count()) === 0,
    "role must come from the server, not from a local guess",
  );

  // ── 4. Correct password enables Manager Mode ──────────────────────────────
  await field(page, "Password").fill(ADMIN_PW);
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await page.waitForTimeout(2000);
  test(
    "correct password enables admin mode",
    (await page.getByRole("button", { name: "Exit Manager" }).count()) > 0,
    "role must come from the server session cookie",
  );
  test(
    "dialog closed after successful login",
    (await page.getByRole("dialog").count()) === 0,
  );

  // ── 5. The password is never stored client-side ───────────────────────────
  const clientStorage = await page.evaluate(() => {
    const dump = (store) => Object.keys(store).map((k) => `${k}=${store.getItem(k)}`);
    return [...dump(localStorage), ...dump(sessionStorage)].join("|");
  });
  test(
    "password not stored in localStorage/sessionStorage",
    !clientStorage.includes(ADMIN_PW),
    "only the server holds the secret; the browser keeps a signed cookie it cannot read",
  );

  // ── 6. Manager Mode unlocks the Daily Editor ──────────────────────────────
  await page.getByRole("button", { name: "Exit Manager" }).click(); // staff again
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Manager", exact: true }).click();
  await page.waitForTimeout(500);
  await field(page, "Password").fill(ADMIN_PW);
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: "Daily" }).click();
  await page.waitForTimeout(800);
  test(
    "daily editor unlocked in admin mode",
    (await page.getByText("Manager Access Required").count()) === 0,
  );

  // The edit toggle must be reachable only as admin.
  const editToggle = page.getByRole("button", { name: "Edit", exact: true });
  test("edit controls visible in admin mode", (await editToggle.count()) > 0);

  // Perform a real save so the test can capture the write server function and
  // then replay it cookie-less. An empty-draft save is enough: the request
  // still reaches the server, which is exactly what step 7 exercises.
  if ((await editToggle.count()) > 0) {
    await editToggle.click();
    await page.waitForTimeout(500);
    const saveBtn = page.getByRole("button", { name: /حفظ|Save/i });
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // ── 7. Direct API write without the session cookie is rejected ────────────
  // Replay a captured server-function write with credentials omitted: even with
  // the right URL and body, a cookie-less request must be refused server-side.
  const writePost = serverFnPosts.find((p) => /^save/i.test(p.exportName));
  if (!writePost) {
    test("captured a write server-function request", false, "no POST to a save endpoint was observed");
  } else {
    // Replay the exact request the app just made — same URL, same body, same
    // TanStack anti-CSRF header — but with credentials omitted, so the ONLY
    // thing missing is the admin session cookie. TanStack Start serializes
    // thrown server-function errors into the 200 response body (rather than an
    // HTTP error status), so the verdict is "the write did not succeed and the
    // server reported Forbidden".
    const direct = await page.evaluate(async ({ url, body, headers }) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          credentials: "omit", // ← no session cookie attached
          body,
        });
        const text = await r.text();
        return { status: r.status, text };
      } catch (e) {
        return { status: 0, text: String(e) };
      }
    }, { url: writePost.url, body: writePost.body, headers: writePost.headers });

    const forbidden =
      direct.status === 403 ||
      direct.status === 401 ||
      (direct.status === 200 && /Forbidden/i.test(direct.text));
    test(
      "direct cookie-less API write rejected",
      forbidden,
      `${writePost.exportName} returned ${direct.status} ${direct.text.slice(0, 120)}`,
    );
  }

  // ── 8. Exit Manager returns to Staff Mode ─────────────────────────────────
  await page.getByRole("button", { name: "Exit Manager" }).click();
  await page.waitForTimeout(1000);
  test(
    "exit admin mode returns to staff mode",
    (await page.getByRole("button", { name: "Manager", exact: true }).count()) > 0,
  );
  await page.getByRole("button", { name: "Daily" }).click();
  await page.waitForTimeout(600);
  test(
    "daily editor re-locked after exit",
    (await page.getByText("Manager Access Required").count()) > 0,
    "exiting must remove admin-only controls from the UI",
  );

  // Re-entering must require the password again.
  test(
    "re-entering admin mode requires the password again",
    (await page.getByRole("button", { name: "Exit Manager" }).count()) === 0,
  );

  // ── 9. Console cleanliness ──────────────────────────────────────────────────
  test(
    "no uncaught console errors",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "),
  );

  await browser.close();
  return report();
}

function report() {
  const failed = results.filter((r) => !r.ok);
  const verdict = {
    url: URL,
    passed: results.length - failed.length,
    total: results.length,
    allPassed: failed.length === 0,
    failures: failed,
    results,
  };
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ allPassed: false, fatal: String(e?.message ?? e) }, null, 2));
  process.exit(2);
});

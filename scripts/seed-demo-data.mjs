#!/usr/bin/env node
/**
 * Seeds realistic demo data into the LOCAL dev database through the app's own
 * write path — Playwright → Manager login → `saveDashboardState` server fn —
 * so the preview shows real-sized (up to 10-digit) numbers without touching
 * production or opening a second PGLite instance (which would hit the lock).
 *
 * The figures mirror the real September 2026 readings (see the handoff note):
 * Gross target 20,755,410 · H1 cumulative 8,801,551 · latest cumulative
 * 11,608,532 (per 2026-09-19).
 *
 * Restore the empty DB afterwards:
 *   1. Stop the dev server.
 *   2. Replace .pglite-data with screenshots/pglite-backup (taken before seeding).
 *   3. Start the dev server again.
 *
 * Run: node scripts/seed-demo-data.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:8080";
const PERIOD = "2026-09";

function readManagerPassword() {
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

const DEPS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];
const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"];
const PERIODS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

const DEP_TARGETS = {
  TV: 1771530, AC: 687210, MDA: 7866000, SDA: 1685190,
  Mobile: 7757760, Other: 30780, Laptop: 718800, ACC: 238170,
};
const KPI_TARGETS = { Gross: 20755410, Agency: 1500000, Mylo: 8208660, BOXI: 194277, Gift: 65128, CR: 20, GK: 400 };
const DEP_H1 = { TV: 606118, AC: 122348, MDA: 2051337, SDA: 520011, Mobile: 5203411, Other: 1934, Laptop: 220353, ACC: 76039 };
const KPI_H1 = { Gross: 8801551, Agency: 630460, Mylo: 3459924, BOXI: 95844, Gift: 42000, CR: 21, GK: 130 };
const DEP_H2 = { TV: 752254, AC: 135816, MDA: 2629623, SDA: 640074, Mobile: 7080585, Other: 24009, Laptop: 258948, ACC: 87225 };
const KPI_H2 = { Gross: 11608532, Agency: 766591, Mylo: 4355773, BOXI: 128212, Gift: 42000, CR: 21, GK: 135 };

const emptyDept = () => Object.fromEntries(KPIS.map((k) => [k, { plan: 0, result: 0 }]));
const data = {};
for (const p of PERIODS) data[p] = Object.fromEntries(DEPS.map((d) => [d, emptyDept()]));

const state = {
  period: PERIOD,
  data,
  branchKpis: Object.fromEntries(KPIS.map((k) => [k, { plan: KPI_TARGETS[k], result: KPI_H2[k] }])),
  dailyActuals: {},
  branchDailyActuals: {
    [PERIOD]: Object.fromEntries(
      KPIS.map((k) => [k, { "2026-09-15": KPI_H1[k], "2026-09-19": KPI_H2[k] }]),
    ),
  },
  departmentDailyActuals: {
    [PERIOD]: Object.fromEntries(
      DEPS.map((d) => [d, { "2026-09-15": DEP_H1[d], "2026-09-19": DEP_H2[d] }]),
    ),
  },
  departmentTargets: { [PERIOD]: { ...DEP_TARGETS } },
  branchKpiTargets: { [PERIOD]: { ...KPI_TARGETS } },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("header", { timeout: 15000 });
  await page.waitForTimeout(1200);

  // Log in as Manager (the app's own dialog + server session cookie).
  await page.getByRole("button", { name: "Manager", exact: true }).click();
  await page.waitForTimeout(400);
  const pw = readManagerPassword();
  if (!pw) throw new Error("ADMIN_PASSWORD not found in .env");
  await page.locator("label", { hasText: "Password" }).locator("input").first().fill(pw);
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await page.waitForSelector('header button:has-text("Exit Manager")', { timeout: 8000 });

  // Write through the app's own schema-validated server function.
  const write = await page.evaluate(async (payload) => {
    const mod = await import("/src/lib/dashboard-api.ts");
    return mod.saveDashboardState({ data: payload });
  }, state);

  // Read back to verify.
  const read = await page.evaluate(async () => {
    const mod = await import("/src/lib/dashboard-api.ts");
    const s = await mod.loadDashboardState();
    return {
      period: s.period,
      grossTarget: s.branchKpiTargets?.["2026-09"]?.Gross,
      grossH1: s.branchDailyActuals?.["2026-09"]?.Gross?.["2026-09-15"],
      grossH2: s.branchDailyActuals?.["2026-09"]?.Gross?.["2026-09-19"],
      tvTarget: s.departmentTargets?.["2026-09"]?.TV,
      tvH2: s.departmentDailyActuals?.["2026-09"]?.TV?.["2026-09-19"],
    };
  });

  console.log(JSON.stringify({ write, read }, null, 1));
} finally {
  await browser.close();
}

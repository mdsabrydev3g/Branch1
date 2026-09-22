// Inspect what's currently persisted, via the app's own read API (no lock conflict).
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const st = await page.evaluate(async () => {
  const mod = await import("/src/lib/dashboard-api.ts");
  const s = await mod.loadDashboardState();
  return {
    period: s.period,
    dataKeys: Object.keys(s.data ?? {}),
    tvSample: s.data?.["2026-09"]?.TV,
    branchKpis: s.branchKpis,
    depTargets: s.departmentTargets,
    kpiTargets: s.branchKpiTargets,
    branchDaily: s.branchDailyActuals,
    depDaily: s.departmentDailyActuals,
  };
});
console.log(JSON.stringify(st, null, 1));
await browser.close();

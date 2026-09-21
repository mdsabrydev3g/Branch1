import { chromium } from "playwright";
const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"];
const ALL_DEPS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];
const tv = {}, ac = {};
for (let d = 1; d <= 19; d++) {
  const p = `2026-09-${String(d).padStart(2, "0")}`;
  tv[p] = 100000 + d * 8000; ac[p] = 60000 + d * 5000;
}
const state = {
  version: 4, period: "2026-09", data: { "2026-09": {} },
  dailyActuals: {}, branchDailyActuals: {},
  departmentDailyActuals: { "2026-09": { TV: tv, AC: ac } },
  departmentTargets: { "2026-09": { TV: 1500000, AC: 900000 } }, branchKpiTargets: {},
};
for (const dep of ALL_DEPS) { state.data["2026-09"][dep] = {}; for (const k of KPIS) state.data["2026-09"][dep][k] = { plan: 0, result: 0 }; }

const browser = await chromium.launch();
let totalErrors = 0;
const NAVS = [
  ["Home", "Home"],
  ["TV — AC", "TV·AC"],
  ["MDA - SDA", "MDA·SDA"],
  ["Mobile", "Mobile"],
];
for (const [i, navPair] of NAVS.entries()) {
  for (const vp of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.route("**/_serverFn/**", (r) => r.continue());
    await ctx.addInitScript((s) => { if (!localStorage.getItem("fayoum-pcc-v2")) localStorage.setItem("fayoum-pcc-v2", s); }, JSON.stringify(state));
    const page = await ctx.newPage();
    let errs = 0;
    page.on("pageerror", () => errs++);
    page.on("console", (m) => { if (m.type() === "error") { errs++; console.log("  CONSOLE:", m.text().slice(0, 120)); } });
    await page.goto("http://127.0.0.1:8081/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    if (i > 0) {
      await page.getByRole("button", { name: vp.width < 1024 ? navPair[1] : navPair[0] }).first().click();
      await page.waitForTimeout(900);
    }
    const info = await page.evaluate(() => ({
      text: document.body.innerText.trim().length,
      s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth,
      headings: document.querySelectorAll("h1,h2").length,
      blank: document.querySelector("main") ? document.querySelector("main").innerText.trim().length === 0 : true,
    }));
    totalErrors += errs;
    const ok = !info.blank && info.text > 200 && info.s <= info.c + 1 && errs === 0;
    console.log(`${ok ? "OK " : "BAD"} prod-${navPair[0]}-${vp.width}.: chars=${info.text} h=${info.headings} scroll=${info.s}/${info.c} errs=${errs}`);
    await ctx.close();
  }
}
console.log("TOTAL ERRORS:", totalErrors);
await browser.close();

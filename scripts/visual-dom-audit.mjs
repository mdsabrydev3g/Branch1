import { chromium } from "playwright";
const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"];
const ALL_DEPS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];
const tv = {}, ac = {};
for (let d = 1; d <= 19; d++) {
  const p = `2026-09-${String(d).padStart(2, "0")}`;
  tv[p] = 100000 + d * 8000; ac[p] = 60000 + d * 5000;
}
const mk = (targets, daily) => ({
  version: 4, period: "2026-09", data: { "2026-09": {} },
  dailyActuals: {}, branchDailyActuals: {},
  departmentDailyActuals: { "2026-09": daily },
  departmentTargets: { "2026-09": targets }, branchKpiTargets: {},
});

const browser = await chromium.launch();
let fails = 0;
const chk = (id, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} | ${id} ${extra}`);
  if (!cond) fails++;
};

// ============ Overview ============
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route("**/_serverFn/**", (r) => r.request().method() === "GET" ? r.abort() : r.continue());
  const st = mk({ TV: 1500000, AC: 900000 }, { TV: tv, AC: ac });
  for (const dep of ALL_DEPS) st.data["2026-09"][dep] = {};
  for (const k of KPIS) for (const dep of ALL_DEPS) st.data["2026-09"][dep][k] = { plan: 0, result: 0 };
  await ctx.addInitScript((s) => { if (!localStorage.getItem("fayoum-pcc-v2")) localStorage.setItem("fayoum-pcc-v2", s); }, JSON.stringify(st));
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = await page.innerText("body");

  chk("Overview: Fayoum 1 brand", /Fayoum/i.test(body));
  chk("Overview: Manager button", /Manager/i.test(body));
  chk("Overview: Month selector", (await page.locator("select").count()) > 0);
  chk("Overview: CR card", /CR/i.test(body));
  chk("Overview: GK card", /GK/i.test(body));
  chk("Overview: Gift card", /Gift/i.test(body));

  const kpiTable = await page.locator("section:has(h2:has-text('KPI'))").first().innerText();
  chk("Overview: CR/GK/Gift NOT in KPI table", !/^\s*(CR|GK|Gift)\s*$/m.test(kpiTable));

  const thAlign = await page.locator("th:has-text('KPI')").first().evaluate((el) => getComputedStyle(el).textAlign);
  chk("Overview: KPI column left-aligned", thAlign === "left", `got=${thAlign}`);

  const pctColors = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll("main td, main span")) {
      const t = el.textContent.trim();
      if (/^\d{1,3}(\.\d)?%$/.test(t)) out.add(getComputedStyle(el).color);
    }
    return [...out];
  });
  chk("Overview: percentages use >1 color", pctColors.length >= 2, `colors=${pctColors.length}`);

  const secText = await page.locator("section:has(h2:has-text('Sales Sections'))").first().innerText();
  chk("Overview: 3 groups in Sales Sections", /TV/.test(secText) && /MDA/.test(secText) && /Mobile/i.test(secText));
  chk("Overview: status words present", /(Danger|Will Do|Good|Excellent)/i.test(secText));

  const hasCircle = await page.evaluate(() => !!document.querySelector("main svg circle"));
  chk("Overview: branch circle rendered", hasCircle);
  await ctx.close();
}

// ============ TV-AC page ============
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route("**/_serverFn/**", (r) => r.request().method() === "GET" ? r.abort() : r.continue());
  const st = mk({ TV: 1500000, AC: 900000 }, { TV: tv, AC: ac });
  for (const dep of ALL_DEPS) st.data["2026-09"][dep] = {};
  for (const k of KPIS) for (const dep of ALL_DEPS) st.data["2026-09"][dep][k] = { plan: 0, result: 0 };
  await ctx.addInitScript((s) => { if (!localStorage.getItem("fayoum-pcc-v2")) localStorage.setItem("fayoum-pcc-v2", s); }, JSON.stringify(st));
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "TV — AC" }).first().click();
  await page.waitForTimeout(1000);
  const body = await page.innerText("body");

  chk("TVAC: TV + AC Total section", /TV\s*\+\s*AC\s*Total/i.test(body));
  chk("TVAC: 80% checkpoint row", /80%/i.test(body));
  chk("TVAC: 85% checkpoint row", /85%/i.test(body));
  chk("TVAC: Half 1 visible", /Half\s*1/i.test(body));
  chk("TVAC: Half 2 visible (day 19)", /Half\s*2/i.test(body));
  chk("TVAC: total target = 2,400,000", /2,400,000/.test(body));
  chk("TVAC: no manual inputs on display page", (await page.locator("main input").count()) === 0);

  const colors = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll("main td, main span, main div")) {
      const t = el.textContent.trim();
      if (/^\d{1,3}(\.\d)?%$/.test(t)) out.add(getComputedStyle(el).color);
    }
    return [...out];
  });
  chk("TVAC: percentages colored (>=2 colors)", colors.length >= 2, `n=${colors.length}`);
  await ctx.close();
}

console.log(`\nالنتيجة: ${fails === 0 ? "كل الفحوصات ناجحة" : fails + " فشل"}`);
process.exit(fails === 0 ? 0 : 1);

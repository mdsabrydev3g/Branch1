import { chromium } from "playwright";
const KPIS = ["Gross","Agency","BOXI","Mylo","CR","GK","Gift"];
const ALL_DEPS = ["TV","AC","MDA","SDA","Laptop","Other","Mobile","ACC"];
function makeState(period, targets, depDaily) {
  const data = { [period]: {} };
  for (const dep of ALL_DEPS) { data[period][dep] = {}; for (const k of KPIS) data[period][dep][k] = { plan: 0, result: 0 }; }
  return { version: 4, period, data, dailyActuals: {}, branchDailyActuals: {},
    departmentDailyActuals: { [period]: depDaily }, departmentTargets: { [period]: targets }, branchKpiTargets: {} };
}
const tv={}, ac={}, mda={}, sda={}, tm={}, il={};
for (let d=1; d<=19; d++) {
  const p = `2026-09-${String(d).padStart(2,"0")}`;
  tv[p]=100000+d*8000; ac[p]=60000+d*5000; mda[p]=200000+d*12000; sda[p]=120000+d*7000;
  tm[p]=90000+d*6000; il[p]=50000+d*3000;
}
const CASES = [
  ["tv", ["TV — AC", "TV·AC"], { TV: 1500000, AC: 900000 }, { TV: tv, AC: ac }],
  ["mda", ["MDA - SDA", "MDA·SDA"], { MDA: 2000000, SDA: 1000000 }, { MDA: mda, SDA: sda }],
  ["mobile", ["Mobile", "Mobile"], { "Mobile": 1200000, "Laptop": 700000 }, { "Mobile": tm, "Laptop": il }],
  ["overview", ["Overview", "Home"], { TV: 1500000, AC: 900000 }, { TV: tv, AC: ac }],
];
const browser = await chromium.launch();
let consoleErrors = 0;
for (const [name, nav, targets, depDaily] of CASES) {
  for (const vp of [{width:1440,height:1000},{width:390,height:844}]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.route("**/_serverFn/**", (route) => route.request().method() === "GET" ? route.abort() : route.continue());
    await ctx.addInitScript((s) => { if (!localStorage.getItem("fayoum-pcc-v2")) localStorage.setItem("fayoum-pcc-v2", s); },
      JSON.stringify(makeState("2026-09", targets, depDaily)));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { consoleErrors++; console.log("PAGEERROR:", e.message); });
    await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    const navName = vp.width < 1024 ? nav[1] : nav[0];
    await page.getByRole("button", { name: navName }).first().click();
    await page.waitForTimeout(900);
    const audit = await page.evaluate(() => {
      const out = { clipped: 0, overlap: 0, inputs: document.querySelectorAll("main input").length,
        s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth };
      for (const el of document.querySelectorAll("main td, main div.font-mono, main th")) {
        if (el.scrollWidth > el.clientWidth + 3 && el.textContent.trim()) {
          out.clipped++;
          console.log("CLIPPED:", el.tagName, JSON.stringify(el.textContent.trim().slice(0,60)), el.className);
        }
      }
      const cards = [...document.querySelectorAll("main section section, main .grid > div")];
      for (let i = 0; i < Math.min(cards.length, 60); i++) for (let j = i + 1; j < Math.min(cards.length, 60); j++) {
        if (cards[i].contains(cards[j]) || cards[j].contains(cards[i])) continue;
        const a = cards[i].getBoundingClientRect(), b = cards[j].getBoundingClientRect();
        if (a.width === 0 || b.width === 0) continue;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 3 && oy > 3) out.overlap++;
      }
      return out;
    });
    const tag = `${name}-${vp.width < 1024 ? "mobile" : "desktop"}`;
    const ok = audit.s <= audit.c + 1 && audit.clipped === 0 && audit.overlap === 0;
    console.log(`${ok ? "OK " : "BAD"} ${tag}: overflow=${audit.s}/${audit.c} clipped=${audit.clipped} overlap=${audit.overlap} inputs=${audit.inputs}`);
    await page.screenshot({ path: `screenshots/final-${tag}.png`, fullPage: true });
    await ctx.close();
  }
}
console.log("consoleErrors:", consoleErrors);
await browser.close();

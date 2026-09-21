/**
 * Verify the deployed app: navigate the in-app sidebar to each view and confirm
 * the real migrated figures render. This is a SPA — views switch via state,
 * not URL routes.
 *   node scripts/verify-prod-views.mjs [url]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://fayoum-1-dashboard.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);

const results = {};

/** Click a sidebar nav item by its visible label and check for figures. */
async function checkView(label, checks, shot) {
  // Desktop sidebar; fall back to mobile drawer.
  const link = page.locator(`nav a:has-text("${label}"), button:has-text("${label}")`).first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(1500);
    const text = await page.innerText("body");
    results[label] = Object.fromEntries(
      checks.map((c) => [c, text.includes(c)]),
    );
    if (shot) await page.screenshot({ path: `screenshots/prod-${shot}.png` });
  } else {
    results[label] = { MISSING_NAV: true };
  }
}

await checkView("Mobile", ["7,080,585", "7,757,760", "Mobile Group"], "mobile-view");
await checkView("TV", ["752,254", "TV + AC"], "tv-view");
await checkView("Reports", ["85%", "Automatic"], "reports-view");
await checkView("Daily", ["Manager", "Daily Sales Editor"], "daily-view");
// Back to overview for the final shot.
await checkView("Overview", ["11,608,532", "Created By Mohamed Sabry"], "overview");

console.log(JSON.stringify(results, null, 1));
console.log("page errors:", errors.length ? errors : "none");

const allOk = Object.values(results).every(
  (r) => !r.MISSING_NAV && Object.values(r).every(Boolean),
);
await browser.close();
process.exit(allOk && !errors.length ? 0 : 1);

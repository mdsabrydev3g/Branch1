/**
 * Verify the deployed production app renders real data from Neon.
 *   node scripts/verify-prod.mjs [url]
 */
import { chromium } from "playwright";

const URL = process.argv[2] || "https://fayoum-1-dashboard.vercel.app";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));

await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);

const text = await page.innerText("body");
const numbers = await page.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll("td, .font-mono")) {
    const t = el.textContent?.trim() ?? "";
    if (/^\d{1,3}(,\d{3})*$/.test(t) && t.replace(/,/g, "").length >= 6) {
      out[t] = (out[t] ?? 0) + 1;
    }
  }
  return Object.keys(out).slice(0, 25);
});

await page.screenshot({ path: "screenshots/prod-desktop.png", fullPage: false });

console.log("URL:", URL);
console.log("title:", await page.title());
console.log("big numbers on page:", numbers);
console.log("console errors:", errors.length ? errors : "none");

// Spot-check known Sept 2026 figures that only exist in the migrated data.
const expected = ["1,160,853", "7,080,585", "4,355,773", "766,591", "11,608,532"];
const found = expected.filter((v) => text.includes(v));
console.log("known figures found:", found.length, "/", expected.length, found);

await browser.close();
process.exit(found.length === expected.length && errors.length === 0 ? 0 : 1);

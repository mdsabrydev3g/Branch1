import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8080", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: "screenshots/qa/after-clean-overview.png", fullPage: false });
await page.locator("button", { hasText: "TV — AC" }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshots/qa/after-clean-tvac.png", fullPage: true });
const txt = await page.locator("body").textContent();
for (const fake of ["728,466", "810,000", "1,742,500", "450,000"]) {
  console.log(`${txt.includes(fake) ? "STILL THERE (bad)" : "CLEARED"}  ${fake}`);
}
await browser.close();

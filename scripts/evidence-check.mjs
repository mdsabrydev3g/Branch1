// Focused evidence pass: the first-half figures on the 4 pages.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8080", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const pages = [
  ["Reports", "8,801,551"],
  ["TV — AC", "728,466"],
  ["MDA - SDA", "2,571,348"],
  ["Mobile", "5,501,737"],
];

for (const [nav, expected] of pages) {
  await page.locator("button", { hasText: nav }).first().click();
  await page.waitForTimeout(700);
  const count = await page.getByText(expected).count();
  const shot = `screenshots/qa/evidence-${nav.replace(/[^a-z]/gi, "").toLowerCase()}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`${count > 0 ? "FOUND" : "MISSING"}  ${nav}: ${expected}  (${shot})`);
}

await browser.close();

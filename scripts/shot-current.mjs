import { chromium } from "playwright";
const browser = await chromium.launch();
const shots = [
  { t: "dark", w: 1440, h: 900, f: "before-dark-desktop" },
  { t: "light", w: 1440, h: 900, f: "before-light-desktop" },
  { t: "dark", w: 390, h: 844, f: "before-dark-mobile" },
  { t: "light", w: 390, h: 844, f: "before-light-mobile" },
];
for (const { t, w, h, f } of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript((th) => { try { localStorage.setItem("f1-theme", th); } catch {} }, t);
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `screenshots/${f}.png` });
  // also a table close-up on desktop
  if (w > 1000) {
    const tbl = page.locator("table").first();
    await tbl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/${f}-table.png` });
  }
  await page.close();
}
console.log("done");
await browser.close();

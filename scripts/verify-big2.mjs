import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
// Log in as manager so we can write
await page.getByRole("button", { name: "Manager" }).click();
await page.waitForTimeout(500);
await page.locator("label", { hasText: "Password" }).locator("input").first().fill("Fay1");
await page.getByRole("button", { name: "Enter", exact: true }).click();
await page.waitForTimeout(2200);
// Inject large numbers directly into the store + persist server-side
const t = await page.evaluate(async () => {
  const st = window.__perfStore__ ?? null;
  // use the store's own API through the React tree is complex; instead set via saveBatchDaily path:
  return "probe";
});
// Use the daily editor save path instead
await page.getByRole("button", { name: "Daily" }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Edit", exact: true }).click();
await page.waitForTimeout(500);
// Fill department actuals with big numbers
const inputs = await page.locator("input[type='number']").count();
console.log("number inputs:", inputs);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("input[type='number']")];
  rows.forEach((i, idx) => { i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
});
// type big values into the first 4 inputs
for (let i = 0; i < Math.min(4, inputs); i++) {
  const el = page.locator("input[type='number']").nth(i);
  await el.click();
  await el.fill("1250000");
}
await page.getByRole("button", { name: /حفظ|Save/i }).click();
await page.waitForTimeout(2500);
// back to overview and measure
await page.getByRole("button", { name: "Home" }).click();
await page.waitForTimeout(1500);
const cells = await page.evaluate(() => {
  const tbl = document.querySelector("table");
  if (!tbl) return null;
  let worst = 0, worstWhat = "";
  tbl.querySelectorAll("td").forEach((c) => {
    const cw = c.getBoundingClientRect().width;
    const inner = c.querySelector("span") || c;
    if (inner.scrollWidth > cw + 0.5) { const d = inner.scrollWidth - cw; if (d > worst) { worst = d; worstWhat = c.textContent.trim(); } }
  });
  return {
    rows: [...tbl.querySelectorAll("tbody tr")].slice(0, 3).map(r => [...r.querySelectorAll("td")].map(c => c.textContent.trim())),
    tblW: Math.round(tbl.getBoundingClientRect().width),
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    worst: Math.round(worst), worstWhat,
  };
});
console.log("rows:", JSON.stringify(cells.rows));
console.log(`tbl=${cells.tblW} docOverflow=${cells.docOverflow} cellOverflow=${cells.worst}px "${cells.worstWhat}"`);
await page.screenshot({ path: "screenshots/after-dark-mobile-big.png" });
await browser.close();

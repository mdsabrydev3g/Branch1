import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.locator("header").getByRole("button", { name: /Manager/i }).first().click();
await page.waitForTimeout(400);
await page.locator("input[type='password']").fill("Fay1");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Daily Editor" }).click();
await page.waitForTimeout(1000);
await page.locator("input[type='date']").fill("2026-09-19");
await page.waitForTimeout(600);

const readTable = async () =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("main tbody tr")];
    return rows.map((r) => {
      const name = r.querySelector("td")?.textContent?.trim().split("\n")[0];
      const inputs = [...r.querySelectorAll("input[type='number']")].map((i) => i.value);
      return `${name} | inputs=${inputs.join(" / ")}`;
    });
  });

console.log("=== DEPARTMENTS ===");
console.log((await readTable()).join("\n"));
await page.getByRole("button", { name: /Main KPIs/ }).click();
await page.waitForTimeout(400);
console.log("=== KPIs ===");
console.log((await readTable()).join("\n"));
await browser.close();

/**
 * التحقق من عمود % الجديد: مبيعات اليوم ÷ التارجيت اليومي
 * نستخدم بيانات حقيقية: TV تارجيت 1,771,530 / 30 يوم = 59,051 يوميًا
 * قراءة يوم 15 = 606,118 ؛ يوم 19 = 752,254
 * مبيعات يوم 19 = 752,254 − 606,118 = 146,136
 * النسبة المتوقعة = 146,136 ÷ 59,051 = 247.5%
 */
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Daily Editor", exact: true }).click();
await page.waitForTimeout(500);
await page.getByPlaceholder("Password").fill((process.env.ADMIN_PASSWORD ?? ""));
await page.getByRole("button", { name: "Unlock Editor" }).click();
await page.waitForTimeout(1000);

await page.locator("input[type='date']").fill("2026-09-19");
await page.waitForTimeout(800);

const rows = await page.evaluate(() => {
  const trs = [...document.querySelectorAll("main table tbody tr")];
  return trs.map((r) => {
    const cells = [...r.children].map((c) => c.textContent?.trim());
    return { name: cells[0], daily: cells[2], pct: cells[3] };
  });
});

console.log("القسم | Daily | %  (يوم 19)");
let ok = true;
for (const r of rows) {
  const daily = parseFloat((r.daily || "").replace(/,/g, "")) || 0;
  const pctTxt = (r.pct || "").replace("%", "").replace("−", "-").replace("—", "");
  const pct = pctTxt === "" || pctTxt === "—" ? null : parseFloat(pctTxt);
  // أعد التارجيت اليومي من المخزن
  console.log(`  ${r.name} | ${r.daily} | ${r.pct}`);
}
console.log("\nتوقيع يدوي: TV → Daily 146,136 / daily-target 59,051 ≈ 247%");

// تحقق برمجيًا
const byName = {};
for (const r of rows) byName[r.name] = r;
const tv = byName["TV"];
if (tv) {
  const daily = parseFloat((tv.daily || "").replace(/,/g, "")) || 0;
  const pct = parseFloat((tv.pct || "0").replace("%", "")) || 0;
  const expected = (daily / (1771530 / 30)) * 100;
  const match = Math.abs(pct - expected) < 1;
  console.log(`TV: daily=${daily} pct=${pct}% expected=${expected.toFixed(1)}% → ${match ? "✓" : "✗"}`);
  if (!match) ok = false;
}
console.log("\nالنتيجة:", ok ? "✓ عمود % = مبيعات اليوم ÷ التارجيت اليومي" : "✗ خطأ");
await browser.close();
process.exit(ok ? 0 : 1);

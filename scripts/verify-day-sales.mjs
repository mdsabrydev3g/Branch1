/**
 * إثبات أن اختيار يوم في Daily Editor يعرض مبيعات ذلك اليوم تحديدًا.
 * يقرأ القراءات التراكمية المخزنة ويحاكي حساب عمود Daily لـيومين مختلفين.
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

// خذ القراءات التراكمية كما تعرضها الخانات لليومين 15 و 19
const read = async (date) => {
  await page.locator("input[type='date']").fill(date);
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll("main table tbody tr")];
    return rows.map((r) => {
      const name = r.querySelector("td")?.textContent?.trim();
      const input = r.querySelector("input")?.value;
      // عمود Daily = ثالث عمود
      const daily = r.children[2]?.textContent?.trim();
      return { name, input, daily };
    });
  });
};

const day15 = await read("2026-09-15");
const day19 = await read("2026-09-19");

console.log("القسم | قراءة 15 | Daily@15 | قراءة 19 | Daily@19 | الفرق(19-15)");
let ok = true;
for (let i = 0; i < day15.length; i++) {
  const a = day15[i], b = day19[i];
  const cumA = parseFloat((a.input || "0").replace(/,/g, "")) || 0;
  const cumB = parseFloat((b.input || "0").replace(/,/g, "")) || 0;
  const dailyB = parseFloat((b.daily || "0").replace(/,/g, "")) || 0;
  const diff = cumB - cumA;
  const match = Math.abs(diff - dailyB) < 1;
  if (!match) ok = false;
  console.log(`${a.name} | ${cumA.toLocaleString()} | ${a.daily} | ${cumB.toLocaleString()} | ${b.daily} | ${diff.toLocaleString()} ${match ? "✓" : "✗"}`);
}
console.log("\nالنتيجة:", ok ? "✓ عمود Daily = فرق القراءات بين اليومين (الكمية المباعة في اليوم المختار)" : "✗ عدم تطابق");
await browser.close();
process.exit(ok ? 0 : 1);

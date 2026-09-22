/**
 * إعادة إدخال البيانات الكاملة بعد فقدان قاعدة بيانات dev
 * (PGLite في الذاكرة — reset عند إعادة التشغيل):
 *   1) تاريخ 2026-09-15: محققات النصف الأول + كل التارجيتات
 *   2) تاريخ 2026-09-19: محققات النصف الثاني (النظام يحسب الفرق)
 *
 * الاستخدام: node scripts/re-enter-data.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const PASSWORD = (process.env.ADMIN_PASSWORD ?? "");

const DEPS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];

/** التارجيتات الشهرية (تُدخل في تاريخ 15-9 وتبقى ثابتة) */
const DEP_TARGETS = {
  TV: 1771530,
  AC: 687210,
  MDA: 7866000,
  SDA: 1685190,
  "Mobile": 7757760,
  "Other": 30780,
  "Laptop": 718800,
  "ACC": 238170,
};
const KPI_TARGETS = {
  Gross: 20755410,
  Agency: 1500000,
  Mylo: 8208660,
  BOXI: 194277,
  Gift: 65128,
  CR: 20,
  GK: 400,
};

/** محققات النصف الأول (تراكمي حتى 2026-09-15) */
const DEP_H1 = {
  TV: 606118, AC: 122348, MDA: 2051337, SDA: 520011,
  "Mobile": 5203411, "Other": 1934, "Laptop": 220353, "ACC": 76039,
};
const KPI_H1 = {
  Gross: 8801551, Agency: 630460, Mylo: 3459924, BOXI: 95844, Gift: 42000, CR: 21, GK: 130,
};

/** محققات النصف الثاني (تراكمي حتى 2026-09-19) */
const DEP_H2 = {
  TV: 752254, AC: 135816, MDA: 2629623, SDA: 640074,
  "Mobile": 7080585, "Other": 24009, "Laptop": 258948, "ACC": 87225,
};
const KPI_H2 = {
  Gross: 11608532, Agency: 766591, Mylo: 4355773, BOXI: 128212, Gift: 42000, CR: 21, GK: 135,
};

async function findRow(page, label) {
  const rows = page.locator("main tbody tr");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const txt = (await rows.nth(i).locator("td").first().textContent())?.trim() ?? "";
    if (txt.startsWith(label)) return rows.nth(i);
  }
  throw new Error(`صف غير موجود: ${label}`);
}

async function setPair(page, label, target, actual, setTarget) {
  const row = await findRow(page, label);
  const inputs = row.locator("input[type='number']");
  if ((await inputs.count()) < 2) throw new Error(`${label}: inputs ناقصة`);
  const t = inputs.first();
  const a = inputs.last();
  if (setTarget) {
    await t.click();
    await t.fill("");
    await t.fill(String(target));
    if (String(await t.inputValue()) !== String(target)) throw new Error(`تارجيت ${label}`);
  }
  await a.click();
  await a.fill("");
  await a.fill(String(actual));
  if (String(await a.inputValue()) !== String(actual)) throw new Error(`محقق ${label}`);
  console.log(`    ✓ ${label} | actual=${actual}${setTarget ? ` | target=${target}` : ""}`);
}

async function enterAt(page, date, depActuals, kpiActuals, withTargets) {
  console.log(`  → التاريخ ${date}`);
  await page.locator("input[type='date']").fill(date);
  await page.waitForTimeout(500);
  await page.locator("main").getByRole("button", { name: "تعديل" }).first().click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /Departments/ }).click();
  await page.waitForTimeout(300);
  for (const dep of DEPS) {
    await setPair(page, dep, DEP_TARGETS[dep], depActuals[dep], withTargets);
  }

  await page.getByRole("button", { name: /Main KPIs/ }).click();
  await page.waitForTimeout(300);
  for (const kpi of Object.keys(KPI_TARGETS)) {
    await setPair(page, kpi, KPI_TARGETS[kpi], kpiActuals[kpi], withTargets);
  }

  console.log("  → الحفظ");
  await page.locator("main").getByRole("button", { name: "حفظ التعديلات" }).click();
  for (let i = 0; i < 40; i++) {
    const ok = await page.locator("main").getByRole("button", { name: "Saved & Synced!" }).isVisible().catch(() => false);
    const back = await page.locator("main").getByRole("button", { name: "تعديل" }).first().isVisible().catch(() => false);
    if (ok || back) break;
    await page.waitForTimeout(200);
  }
  console.log("  ✓ تم");
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log("→ فتح الصفحة ووضع المدير");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator("header").getByRole("button", { name: /Manager/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator("input[type='password']").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(600);

  console.log("→ Daily Editor");
  await page.getByRole("button", { name: "Daily Editor" }).click();
  await page.waitForTimeout(1000);
  const unlock = page.locator("main").getByRole("button", { name: "Unlock Editor" });
  if (await unlock.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.locator("main input[type='password']").fill(PASSWORD);
    await unlock.click();
    await page.waitForTimeout(600);
  }

  console.log("=== النصف الأول + التارجيتات (2026-09-15) ===");
  await enterAt(page, "2026-09-15", DEP_H1, KPI_H1, true);

  console.log("=== النصف الثاني (2026-09-19) ===");
  await enterAt(page, "2026-09-19", DEP_H2, KPI_H2, false);

  await page.screenshot({ path: "screenshots/re-entered.png", fullPage: true });
  await browser.close();
  console.log("\n✅ تمت إعادة إدخال البيانات");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });

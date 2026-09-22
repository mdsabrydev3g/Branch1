/**
 * تدقيق صفحة Daily Sales Editor بعد التبسيط:
 *  - الجدولان يحتويان على 4 أعمدة فقط (Department/KPI / Actual / Daily / %)
 *  - لا يوجد اسكرول أفقي على 390px أو 1440px
 *  - تم حذف: Monthly Target / Target (Plan) / Track / Status / الجمل
 *  - شريط الحفظ السفلي لم يعد موجوداً
 *
 * الاستخدام: node scripts/qa-daily-editor.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const PASSWORD = (process.env.ADMIN_PASSWORD ?? "");

const BANNED = [
  "Monthly Target",
  "Target (Plan)",
  "Track",
  "Achievement",
  "Cumulative",
  "الحقول مقفولة",
  "الحقول للعرض فقط",
  "مبيعات اليوم = الفرق",
  "أدخل المحقق التراكمي",
];

const failures = [];
const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
}

async function scrollAudit(page, label) {
  return page.evaluate((l) => {
    const de = document.documentElement;
    const horiz = de.scrollWidth > de.clientWidth + 1;
    const scrollers = [...document.querySelectorAll("*")].filter((el) => {
      if (el === document.body || el === de) return false;
      const s = getComputedStyle(el);
      return (
        (s.overflowX === "auto" || s.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      );
    });
    return { label: l, horiz, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, scrollers: scrollers.length };
  }, label);
}

async function auditTab(page, tabLabel, kind) {
  console.log(`\n→ التبويب: ${tabLabel}`);
  await page.getByRole("button", { name: new RegExp(tabLabel) }).click();
  await page.waitForTimeout(400);

  const headers = await page.locator("main table thead th").allTextContents();
  const clean = headers.map((h) => h.trim());
  console.log(`    الأعمدة: ${JSON.stringify(clean)}`);
  check(`${kind}: 4 أعمدة فقط`, clean.length === 4, `got ${clean.length}: ${clean.join(", ")}`);
  check(`${kind}: لا يوجد Monthly Target`, !clean.some((h) => h.includes("Monthly")));
  check(`${kind}: لا يوجد Target (Plan)`, !clean.some((h) => h.includes("Target")));
  check(`${kind}: لا يوجد Track`, !clean.some((h) => h.includes("Track")));
  check(`${kind}: لا يوجد Status`, !clean.some((h) => h.toLowerCase().includes("status")));
  check(`${kind}: العمود الأخير هو %`, clean[clean.length - 1] === "%", `got "${clean[clean.length - 1]}"`);
  check(`${kind}: عمود Actual موجود`, clean.some((h) => h === "Actual"));
  check(`${kind}: عمود Daily موجود`, clean.some((h) => h === "Daily"));

  // صفوف الجدول
  const rows = await page.locator("main tbody tr").count();
  const inputs = await page.locator("main tbody input[type='number']").count();
  console.log(`    صفوف=${rows} مدخلات=${inputs}`);
  check(`${kind}: عدد المدخلات = عدد الصفوف`, inputs === rows, `rows=${rows} inputs=${inputs}`);

  // محاذاة الأعمدة بين الهيدر والصفوف
  const widths = await page.evaluate(() => {
    const ths = [...document.querySelectorAll("main table thead th")];
    const tds = [...document.querySelectorAll("main tbody tr:first-child td")];
    return {
      th: ths.map((t) => Math.round(t.getBoundingClientRect().width)),
      td: tds.map((t) => Math.round(t.getBoundingClientRect().width)),
    };
  });
  const aligned = widths.th.length === widths.td.length && widths.th.every((w, i) => Math.abs(w - widths.td[i]) < 3);
  check(`${kind}: الهيدر محازي مع الصفوف`, aligned, `th=${widths.th.join("/")} td=${widths.td.join("/")}`);

  // النسب المئوية في عمود % كلها محازية لليمين
  const pctRight = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("main tbody tr td:last-child")];
    if (!cells.length) return null;
    const rights = cells.map((c) => Math.round(c.getBoundingClientRect().right));
    const same = new Set(rights).size === 1;
    return { same, rights: [...new Set(rights)] };
  });
  check(`${kind}: خانات % محازية تحت بعضها`, pctRight?.same === true, JSON.stringify(pctRight?.rights));

  // المدخلات محازية
  const inpRight = await page.evaluate(() => {
    const ins = [...document.querySelectorAll("main tbody tr td:nth-child(2) input")];
    if (!ins.length) return null;
    const lefts = ins.map((i) => Math.round(i.getBoundingClientRect().left));
    return { same: new Set(lefts).size === 1, lefts: [...new Set(lefts)] };
  });
  check(`${kind}: خانات الإدخال محازية تحت بعضها`, inpRight?.same === true, JSON.stringify(inpRight?.lefts));

  return clean;
}

async function main() {
  const browser = await chromium.launch();

  for (const [w, h, label] of [
    [390, 844, "موبايل 390px"],
    [1440, 900, "ديسكتوب 1440px"],
  ]) {
    console.log(`\n========== ${label} ==========`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const consoleErrs = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160));
    });

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.locator("header").getByRole("button", { name: /Manager/i }).first().click();
    await page.waitForTimeout(400);
    await page.locator("input[type='password']").fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(600);

    await page.getByRole("button", { name: w < 768 ? "Daily" : "Daily Editor" }).click();
    await page.waitForTimeout(1000);
    const unlock = page.locator("main").getByRole("button", { name: "Unlock Editor" });
    if (await unlock.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.locator("main input[type='password']").fill(PASSWORD);
      await unlock.click();
      await page.waitForTimeout(600);
    }

    // النصوص المحظورة في الصفحة كلها
    const body = (await page.locator("main").textContent()) ?? "";
    for (const phrase of BANNED) {
      check(`${label}: لا يحتوي "${phrase}"`, !body.includes(phrase));
    }

    // زر Edit واحد فقط بجانب التاريخ
    const editBtns = await page.locator("main").getByRole("button", { name: "Edit" }).count();
    check(`${label}: زر Edit واحد فقط`, editBtns === 1, `found ${editBtns}`);

    // لا يوجد زر "حفظ التعديلات" في وضع العرض
    const saveBtns = await page.locator("main").getByRole("button", { name: /حفظ التعديلات|Save Changes/ }).count();
    check(`${label}: لا يوجد شريط حفظ سفلي`, saveBtns === 0, `found ${saveBtns}`);

    await auditTab(page, "Departments", `${label} Departments`);
    await auditTab(page, "Main KPIs", `${label} KPIs`);

    const scroll = await scrollAudit(page, label);
    console.log(`    scrollWidth=${scroll.scrollWidth} clientWidth=${scroll.clientWidth} scrollers=${scroll.scrollers}`);
    check(`${label}: لا اسكرول أفقي بالصفحة`, !scroll.horiz && scroll.scrollers === 0,
      `sw=${scroll.scrollWidth} cw=${scroll.clientWidth} inner=${scroll.scrollers}`);

    check(`${label}: لا أخطاء بالكونسول`, consoleErrs.length === 0, consoleErrs.join(" | "));

    await page.screenshot({ path: `screenshots/daily-editor-${w}-deps.png`, fullPage: true });
    await page.getByRole("button", { name: /Main KPIs/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/daily-editor-${w}-kpis.png`, fullPage: true });

    await ctx.close();
  }

  await browser.close();

  console.log("\n========== الملخص ==========");
  console.log(`فحوصات: ${checks.length} | ناجحة: ${checks.filter((c) => c.ok).length} | فاشلة: ${failures.length}`);
  if (failures.length) {
    console.log("\n✗ فشل:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  console.log("\n✅ كل الفحوصات نجحت");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});

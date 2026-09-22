/**
 * تدقيق دفعة Batch C:
 *  - صفحة Home: سطر Created By Mohamed Sabry / Sep 2026 أسفل Sales Sections
 *  - Daily Editor: الجدولان محازيان في المنتصف (header + cells + inputs)
 *  - حذف: «كل الحسابات حتى الأمس» و«نصف أول المجموعة» من كل الأقسام
 *  - حذف السطر التحت عناوين TV + AC / MDA + SDA / Mobile Group
 *  - Reports: لا بطاقة 80% milestone، والتسمية 85% فقط
 *  - زر Edit بدلاً من تعديل
 *  - اللوجو صورة (f1.png) بدلاً من نص F1
 *
 * الاستخدام: node scripts/qa-batch-c.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const PASSWORD = (process.env.ADMIN_PASSWORD ?? "");

const failures = [];
const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
}

const BANNED_EVERYWHERE = [
  "كل الحسابات حتى الأمس",
  "للعرض فقط",
  "نصف أول المجموعة",
  "نصف اول المجموعة",
  "80% milestone",
  "85% milestone",
];

async function visibleText(page) {
  return page.evaluate(() => document.body.innerText ?? "");
}

async function navTo(page, label) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // ── Home / Overview ──────────────────────────────
  console.log("\n→ Home (Overview)");
  {
    const text = await visibleText(page);
    check("Home: Created By Mohamed Sabry موجود", text.includes("Created By Mohamed Sabry"));
    check("Home: Sep 2026 موجود", /Sep\s*2026/.test(text));

    // الموقع: أسفل جدول Sales Sections (آر عنصر في الصفحة)
    const footerY = await page
      .locator("footer")
      .first()
      .boundingBox()
      .then((b) => (b ? b.y : -1));
    const sectionY = await page
      .locator("h2", { hasText: "Sales Sections" })
      .first()
      .boundingBox()
      .then((b) => (b ? b.y : -1));
    check(
      "Home: السطر أسفل Sales Sections",
      footerY > sectionY && sectionY > 0,
      `footer y=${Math.round(footerY)}, section y=${Math.round(sectionY)}`,
    );

    const de = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    check("Home: لا يوجد اسكرول أفقي", de.sw <= de.cw + 1, `${de.sw} vs ${de.cw}`);
  }

  // ── اللوجو ──────────────────────────────────────
  console.log("\n→ Header logo");
  {
    // الواجهة تحمل نسختَي اللوجو (نهاري/ليلي) وCSS يُظهر واحدة فقط — نختار الظاهرة.
    const logo = page.locator("header img[src*='f1']:visible, aside img[src*='f1']:visible").first();
    const count = await page.locator("img[src*='f1']").count();
    check("اللوجو: صورة F1 موجودة", count >= 1, `found ${count}`);
    if (count > 0) {
      const box = await logo.boundingBox();
      check("اللوجو: أبعاد معقولة (ارتفاع 28–48px)", !!box && box.height >= 28 && box.height <= 48, `h=${box && Math.round(box.height)}`);
      // نسبة العرض/الارتفاع قريبة من أصل الصورة 835×469
      if (box) {
        const ratio = box.width / box.height;
        check("اللوجو: يحافظ على نسبة الصورة (±10%)", Math.abs(ratio - 835 / 469) < 0.18, `ratio=${ratio.toFixed(2)}`);
      }
    }
    check("اللوجو: لا يوجد نص F1 داخل العلامة", (await page.locator(".brand-mark").count()) === 0);
    // الصورة محمّلة فعلًا (not broken)
    const broken = await page.evaluate(() => {
      return [...document.querySelectorAll("img")].some((img) => img.complete && img.naturalWidth === 0);
    });
    check("اللوجو: الصورة محمّلة وليست مكسورة", !broken);
  }

  // ── TV — AC ──────────────────────────────────────
  console.log("\n→ TV — AC");
  await navTo(page, "TV — AC");
  {
    const text = await visibleText(page);
    for (const b of BANNED_EVERYWHERE) {
      check(`TV-AC: غائب «${b}»`, !text.includes(b));
    }
    check("TV-AC: عنوان TV + AC موجود", text.includes("TV + AC") && !text.includes("TV + AC Total"));
    const hasSub = await page.evaluate(() => {
      // السطر التحت العنوان: أي <p> داخل نفس رأس القسم
      const heads = [...document.querySelectorAll("section h2")];
      const totalHead = heads.find((h) => h.textContent?.includes("TV + AC"));
      if (!totalHead) return false;
      const p = totalHead.parentElement?.querySelector("p");
      return !!p && p.textContent?.trim() !== "";
    });
    check("TV-AC: لا سطر تحت TV + AC", !hasSub);
  }

  // ── MDA - SDA ────────────────────────────────────
  console.log("\n→ MDA - SDA");
  await navTo(page, "MDA - SDA");
  {
    const text = await visibleText(page);
    for (const b of BANNED_EVERYWHERE) {
      check(`MDA-SDA: غائب «${b}»`, !text.includes(b));
    }
    check("MDA-SDA: عنوان MDA + SDA موجود", text.includes("MDA + SDA") && !text.includes("MDA + SDA Total"));
    const hasSub = await page.evaluate(() => {
      const heads = [...document.querySelectorAll("section h2")];
      const totalHead = heads.find((h) => h.textContent?.includes("MDA + SDA"));
      if (!totalHead) return false;
      const p = totalHead.parentElement?.querySelector("p");
      return !!p && p.textContent?.trim() !== "";
    });
    check("MDA-SDA: لا سطر تحت MDA + SDA", !hasSub);
  }

  // ── Mobile ───────────────────────────────────────
  console.log("\n→ Mobile");
  await navTo(page, /^Mobile$/);
  {
    const text = await visibleText(page);
    for (const b of BANNED_EVERYWHERE) {
      check(`Mobile: غائب «${b}»`, !text.includes(b));
    }
    check("Mobile: عنوان Mobile Group موجود", text.includes("Mobile Group") && !text.includes("Mobile Group Total"));
    const hasSub = await page.evaluate(() => {
      const heads = [...document.querySelectorAll("section h2")];
      const totalHead = heads.find((h) => h.textContent?.includes("Mobile Group"));
      if (!totalHead) return false;
      const p = totalHead.parentElement?.querySelector("p");
      return !!p && p.textContent?.trim() !== "";
    });
    check("Mobile: لا سطر تحت Mobile Group", !hasSub);
  }

  // ── Reports ──────────────────────────────────────
  console.log("\n→ Reports");
  await navTo(page, "Report");
  {
    const text = await visibleText(page);
    check("Reports: غائب «80% milestone»", !text.includes("80% milestone"));
    check("Reports: غائب «85% milestone»", !text.includes("85% milestone"));
    check("Reports: التسمية «85%» موجودة", text.includes("85%"));
    // لا توجد بطاقة رابع في Target progress — نعدّ البطاقات المباشرة للشبكة
    const cards = await page.evaluate(() => {
      const heads = [...document.querySelectorAll("h2")];
      const sec = heads.find((h) => h.textContent?.trim() === "Target progress")?.closest("section");
      if (!sec) return -1;
      // HalfSummary = أول div يحتوي على شبكة فرعية بداخله
      const grid = sec.querySelector(".grid");
      if (!grid) return -1;
      return [...grid.children].filter((c) => c.tagName === "DIV").length;
    });
    check("Reports: 3 بطاقات في Target progress (كانت 4)", cards === 3, `got ${cards}`);
  }

  // ── Daily Editor ────────────────────────────────
  console.log("\n→ Daily Editor");
  await navTo(page, "Daily Editor");
  {
    // تسجيل دخول المدير
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Unlock Editor" }).click();
    await page.waitForTimeout(800);

    const text = await visibleText(page);
    check("Editor: زر Edit موجود", text.includes("Edit"));
    check("Editor: كلمة تعديل غائبة", !text.includes("تعديل"));

    // زر Edit ظاهر (وضع العرض)
    const editBtn = page.getByRole("button", { name: "Edit", exact: true });
    check("Editor: زر Edit مرئي", (await editBtn.count()) === 1, `count=${await editBtn.count()}`);

    for (const tab of ["Departments", "Main KPIs"]) {
      console.log(`\n  → تبويب ${tab}`);
      await page.getByRole("button", { name: new RegExp(tab) }).click();
      await page.waitForTimeout(400);

      // المحاذاة: كل خلايا الرأس في المنتصف
      const headerAlign = await page.evaluate(() => {
        const ths = [...document.querySelectorAll("main table thead th")];
        return ths.map((th) => getComputedStyle(th).textAlign);
      });
      const allCenterH = headerAlign.every((a) => a === "center");
      check(`${tab}: رؤوس الأعمدة كلها center`, allCenterH, JSON.stringify(headerAlign));

      // خلايا البيانات (الداخلية) محاذاة وسط
      const cellAlign = await page.evaluate(() => {
        const tds = [...document.querySelectorAll("main table tbody td")];
        const aligns = new Set(tds.map((td) => getComputedStyle(td).textAlign));
        return [...aligns];
      });
      check(`${tab}: خلايا الصفوف كلها center`, cellAlign.every((a) => a === "center"), JSON.stringify(cellAlign));

      // محتوى الإدخال في المنتصف
      const inputAlign = await page.evaluate(() => {
        const inputs = [...document.querySelectorAll("main table tbody input")];
        const aligns = new Set(inputs.map((i) => getComputedStyle(i).textAlign));
        return [...aligns];
      });
      check(`${tab}: حقول الإدخال center`, inputAlign.every((a) => a === "center"), JSON.stringify(inputAlign));

      // الأعمدة لا تزال 4
      const cols = await page.locator("main table thead th").count();
      check(`${tab}: 4 أعمدة`, cols === 4, `got ${cols}`);

      // لا اسكرول أفقي
      const de = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      check(`${tab}: لا اسكرول أفقي 1440px`, de.sw <= de.cw + 1, `${de.sw} vs ${de.cw}`);

      // تجربة اختيار يوم: التاريخ الافتراضي → اليوم الحالي
      if (tab === "Departments") {
        const dateVal = await page.locator("input[type='date']").inputValue();
        const localToday = await page.evaluate(() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        });
        check("Editor: حقل التاريخ الافتراضي = اليوم (محلي)", dateVal === localToday, `${dateVal} vs ${localToday}`);

        // اختيار يوم 15-09-2026: عمود Daily يجب أن يعرض مبيعات ذلك اليوم
        await page.locator("input[type='date']").fill("2026-09-15");
        await page.waitForTimeout(600);
        const dailyCol15 = await page.evaluate(() => {
          const ths = [...document.querySelectorAll("main table thead th")];
          const idx = ths.findIndex((th) => th.textContent?.trim() === "Daily");
          if (idx < 0) return null;
          const rows = [...document.querySelectorAll("main table tbody tr")];
          return rows.map((r) => r.children[idx]?.textContent?.trim() ?? "");
        });
        check("Editor: اختيار يوم 15 يعطي قيم Daily", !!dailyCol15 && dailyCol15.some((v) => v && v !== "—" && v !== "0"), JSON.stringify(dailyCol15?.slice(0, 3)));

        // الرجوع لليوم الحالي
        await page.locator("input[type='date']").fill(localToday);
        await page.waitForTimeout(400);
      }
    }
  }

  // ── الموبايل 390px ──────────────────────────────
  console.log("\n→ Mobile 390px");
  {
    const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mpage.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    mpage.on("pageerror", (e) => errors.push(String(e)));
    await mpage.goto(BASE, { waitUntil: "networkidle" });
    await mpage.waitForTimeout(1000);

    const mtext = await visibleText(mpage);
    check("Mobile: Created By Mohamed Sabry موجود", mtext.includes("Created By Mohamed Sabry"));
    check("Mobile: لا اسكرول أفقي", await mpage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

    // اللوجو على الموبايل (السايدبار مخفي — خذ لوجو الـtopbar فقط)
    const mlogo = await mpage.locator("header img[src*='f1']:visible").first().boundingBox();
    check("Mobile: اللوجو مناسب (ارتفاع ≤ 48px)", !!mlogo && mlogo.height <= 48, `h=${mlogo && Math.round(mlogo.height)}`);
    check("Mobile: اللوجو لا يسبب overflow", !!mlogo && mlogo.x + mlogo.width <= 390, `right=${mlogo && Math.round(mlogo.x + mlogo.width)}`);

    // Daily Editor على الموبايل
    await mpage.getByRole("button", { name: "Daily" }).click();
    await mpage.waitForTimeout(600);
    await mpage.getByPlaceholder("Password").fill(PASSWORD);
    await mpage.getByRole("button", { name: "Unlock Editor" }).click();
    await mpage.waitForTimeout(800);
    const mde = await mpage.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    check("Mobile: Daily Editor لا اسكرول أفقي 390px", mde.sw <= mde.cw + 1, `${mde.sw} vs ${mde.cw}`);

    const cellAlignM = await mpage.evaluate(() => {
      const ths = [...document.querySelectorAll("main table thead th")];
      return ths.map((th) => getComputedStyle(th).textAlign);
    });
    check("Mobile: رؤوس الجدول center", cellAlignM.every((a) => a === "center"), JSON.stringify(cellAlignM));

    await mpage.close();
  }

  check("Console: لا أخطاء", errors.length === 0, errors.slice(0, 3).join(" | "));

  console.log("\n────────────────────────────────────────");
  const passed = checks.filter((c) => c.ok).length;
  console.log(`النتيجة: ${passed}/${checks.length} فحص ناجح`);
  if (failures.length) {
    console.log("\nفشل:");
    failures.forEach((f) => console.log(`  ✗ ${f}`));
  }
  await browser.close();
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

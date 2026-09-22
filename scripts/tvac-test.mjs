/**
 * حزمة اختبارات شاملة — نظام المبيعات بالدلالة التراكمية
 * =======================================================
 * الإدخال في Daily Editor = محقق تراكمي حتى التاريخ المختار.
 * مبيعات اليوم = القراءة الحالية − آخر قراءة قبلها.
 *
 * الأقسام المغطاة:
 *   A. صفحة TV-AC (3 مستويات) + MDA-SDA (نفس النظام)
 *   B. صفحة Mobile (قسم مجمّع بجدول الأجزاء الأربعة)
 *   C. Checkpoint 80% (نصف 1) و 85% (نصف 2)
 *   D. Daily Editor: زر Edit + الحفظ بالتاريخ المختار + مبيعات اليوم التلقائي
 *   E. Overview: الدائرة + كروت CR/GK/Gift + جدول KPI + سطور الأقسام
 *   F. الشهور 28/29/30/31 + حدود الأنصافة + الموبايل
 */
import { chromium } from "playwright";

const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"];
const ALL_DEPS = [
  "TV",
  "AC",
  "MDA",
  "SDA",
  "Laptop",
  "Other",
  "Mobile",
  "ACC",
];

function makeState(period, targets, depDaily) {
  const data = { [period]: {} };
  for (const dep of ALL_DEPS) {
    data[period][dep] = {};
    for (const k of KPIS) data[period][dep][k] = { plan: 0, result: 0 };
  }
  return {
    version: 4,
    period,
    data,
    dailyActuals: {},
    branchDailyActuals: {},
    departmentDailyActuals: { [period]: depDaily },
    departmentTargets: { [period]: targets },
    branchKpiTargets: {},
  };
}

const results = [];
const check = (name, cond, extra = "") =>
  results.push((cond ? "PASS" : "FAIL") + " | " + name + (extra ? " | " + extra : ""));

const fmt = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const NOW = new Date();
const todayStr = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-${String(
  NOW.getDate(),
).padStart(2, "0")}`;
const CUR_PERIOD = todayStr.slice(0, 7);
const CUR_TRACKDAY = Math.max(0, NOW.getDate() - 1);
console.log(`today=${todayStr} trackDay=${CUR_TRACKDAY} curPeriod=${CUR_PERIOD}`);

const browser = await chromium.launch();

async function newCtx(viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  await ctx.route("**/_serverFn/**", (r) => r.abort());
  await ctx.addInitScript(
    (s) => {
      if (!localStorage.getItem("fayoum-pcc-v2")) {
        localStorage.setItem("fayoum-pcc-v2", s);
      }
    },
    "", // placeholder — يتم التبديل بالحقنة المخصصة أدناه
  );
  return ctx;
}

/** فتح صفحة مع حقنة حالة مخصصة */
async function openWith(period, targets, depDaily, branchDaily, viewport, navTo) {
  const vp = viewport || { width: 1280, height: 900 };
  const ctx = await browser.newContext({ viewport: vp });
  // عزل تام عن قاعدة بيانات السيرفر: GET الـhydrate والـPOST كلاهما معلق
  // (POST الحفظ كان يكتب الحالة المُستزرَعة فوق بيانات السيرفر الحقيقية).
  // يستجيب POST بـJSON عادي بدون هيدر x-tss-serialized فيعالجه العميل كـJSON
  // صِرف ويعيد {} — فينجح الحفظ محلياً (localStorage) دون المساس بالسيرفر.
  await ctx.route("**/_serverFn/**", (route) =>
    route.request().method() === "GET"
      ? route.abort()
      : route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await ctx.addInitScript(
    (args) => {
      if (!localStorage.getItem("fayoum-pcc-v2")) {
        localStorage.setItem("fayoum-pcc-v2", args.s);
      }
    },
    { s: JSON.stringify(makeState(period, targets, depDaily)) },
  );
  if (branchDaily) {
    // دمج branchDailyActuals داخل الحالة نفسها
    await ctx.addInitScript((args) => {
      const raw = localStorage.getItem("fayoum-pcc-v2");
      if (raw) {
        const st = JSON.parse(raw);
        st.branchDailyActuals = { [args.period]: args.branchDaily };
        localStorage.setItem("fayoum-pcc-v2", JSON.stringify(st));
      }
    }, { period, branchDaily });
  }
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const isMobile = vp.width < 1024;
  if (navTo) {
    await page.getByRole("button", { name: navTo }).first().click();
    await page.waitForTimeout(900);
  }
  return { ctx, page };
}

async function sectionText(page, name) {
  return page.evaluate((dep) => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === dep);
    return sec ? sec.innerText.replace(/\n+/g, " | ") : "SECTION_NOT_FOUND";
  }, name);
}

function metric(text, label) {
  const re = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\|?\\s*([\\d,]+)",
    "i",
  );
  const m = text.match(re);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

async function countText(page, text) {
  return page.evaluate((t) => {
    return [...document.querySelectorAll("main")].reduce(
      (n, el) => n + (el.innerText.split(t).length - 1),
      0,
    );
  }, text);
}

const PAD = (n) => String(n).padStart(2, "0");
const dstr = (y, m, d) => `${y}-${PAD(m)}-${PAD(d)}`;

/* ============================================================
   A. صفحة TV-AC — دلالة تراكمية + checkpoint + ألوان
   ============================================================ */
{
  const period = CUR_PERIOD;
  const [y, m] = period.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const trackDay = Math.max(1, CUR_TRACKDAY);

  // قراءات تراكمية: قراءة يوم 5 = 100k، قراءة يوم 12 = 260k، قراءة يوم 18 = 400k
  const tvDaily = {
    [dstr(y, m, 5)]: 100000,
    [dstr(y, m, 12)]: 260000,
    [dstr(y, m, 18)]: 400000,
  };
  const acDaily = {
    [dstr(y, m, 5)]: 60000,
    [dstr(y, m, 12)]: 140000,
    [dstr(y, m, 18)]: 250000,
  };

  const { ctx, page } = await openWith(
    period,
    { TV: 1200000, AC: 800000 },
    { TV: tvDaily, AC: acDaily },
    null,
    { width: 1280, height: 900 },
    "TV — AC",
  );

  const totalTxt = await sectionText(page, "TV + AC");
  check("A1 | قسم TV + AC موجود", totalTxt !== "SECTION_NOT_FOUND");

  // تراكمي = آخر قراءة ≤ trackDay (القراءات نفسها وليس مجموعها)
  let expectCum = 0;
  for (const [d, v] of Object.entries(tvDaily)) {
    if (Number(d.slice(-2)) <= trackDay) expectCum = Math.max(expectCum, v);
  }
  for (const [d, v] of Object.entries(acDaily)) {
    if (Number(d.slice(-2)) <= trackDay) expectCum += v;
  }
  // آخر قراءة تراكمية لكل قسم عند trackDay >= 18: TV=400k, AC=250k
  const expectedTotalCum = trackDay >= 18 ? 650000 : trackDay >= 12 ? 400000 : trackDay >= 5 ? 160000 : 0;
  const totalCum = metric(totalTxt, "Cum. Actual");
  check(
    "A2 | Cum = آخر قراءة تراكمية (ليست مجموع القراءات)",
    totalCum === expectedTotalCum,
    `got=${totalCum} want=${fmt(expectedTotalCum)} (trackDay=${trackDay})`,
  );

  // Daily Details: Daily = فرق القراءات (يوم 12: TV=160k، يوم 18: TV=140k)
  const rowDay18 = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
    const row = sec ? [...sec.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes("-18")) : null;
    return row ? row.innerText.replace(/\n+/g, " | ") : "ROW_NOT_FOUND";
  });
  if (trackDay >= 18) {
    // فرق TV = 400k−260k=140k، فرق AC=250k−140k=110k، إجمالي اليوم=250k
    check(
      "A3 | Daily يوم 18 = فرق القراءات (250,000)",
      rowDay18.includes("250,000"),
      `row=${rowDay18}`,
    );
    // التراكمي في نفس الصف = 650,000
    check("A4 | Cumulative يوم 18 = 650,000", rowDay18.includes("650,000"), `row=${rowDay18}`);
  } else {
    check("A3/A4 | متخلف (trackDay < 18)", true, "skipped");
  }

  // Checkpoint 80% في Half 1: h1Target = 1,000,000 → 80% = 800,000
  const cpRow = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
    const half1 = sec ? [...sec.querySelectorAll("section")].find((c) => c.querySelector("h3")?.textContent?.trim() === "Half 1") : null;
    return half1 ? half1.innerText.replace(/\n+/g, " | ") : "NOT_FOUND";
  });
  check("A5 | صف Checkpoint 80% موجود في Half 1", /checkpoint 80%/i.test(cpRow), cpRow.slice(0, 120));
  check(
    "A6 | قيمة Checkpoint = 800,000 (80% من 1,000,000)",
    cpRow.includes("800,000"),
    cpRow.slice(0, 200),
  );

  // Checkpoint 85% في Half 2 عند ظهوره
  if (trackDay >= 16) {
    const h2Row = await page.evaluate(() => {
      const secs = [...document.querySelectorAll("main section")];
      const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
      const half2 = sec ? [...sec.querySelectorAll("section")].find((c) => c.querySelector("h3")?.textContent?.trim() === "Half 2") : null;
      return half2 ? half2.innerText.replace(/\n+/g, " | ") : "NOT_FOUND";
    });
    check("A7 | صف Checkpoint 85% موجود في Half 2", /checkpoint 85%/i.test(h2Row), h2Row.slice(0, 120));
    check(
      "A7b | قيمة Checkpoint2 = 850,000 (85% من 1,000,000)",
      h2Row.includes("850,000"),
      h2Row.slice(0, 200),
    );
  }

  // ألوان النسب: خانة Month % ملونة وليست بيضاء/رمادية افتراضية
  const monthPctColored = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
    if (!sec) return false;
    const divs = [...sec.querySelectorAll("div")];
    const lbl = divs.find((d) => d.textContent?.trim() === "Month %");
    if (!lbl) return false;
    const val = lbl.parentElement?.querySelector(".font-mono");
    if (!val) return false;
    const cls = val.className;
    return /text-(emerald|success|warning|danger)/.test(cls);
  });
  check("A8 | نسبة Month % ملونة حسب الحالة", monthPctColored === true);

  // لا حقول إدخال
  const inputCount = await page.locator("main input").count();
  check("A9 | صفحة TV-AC بلا حقول إدخال", inputCount === 0, `found=${inputCount}`);

  // Total = TV + AC
  const tvTxt = await sectionText(page, "TV");
  const acTxt = await sectionText(page, "AC");
  const tvCum = metric(tvTxt, "Cum. Actual");
  const acCum = metric(acTxt, "Cum. Actual");
  check(
    "A10 | Cum: Total = TV + AC",
    tvCum + acCum === totalCum,
    `${fmt(tvCum)} + ${fmt(acCum)} vs ${fmt(totalCum)}`,
  );

  await ctx.close();
}

/* ============================================================
   B. صفحة Mobile — قسم مجمّع للأجزاء الأربعة
   ============================================================ */
{
  const period = "2026-04"; // 30 يوم، شهر سابق → trackDay=30
  const mk = (base, step) => {
    const o = {};
    let cum = 0;
    for (let d = 1; d <= 10; d++) {
      cum += base + step * d;
      o[dstr(2026, 4, d)] = cum;
    }
    return o;
  };
  const targets = {
    "Mobile": 400000,
    "Laptop": 300000,
    "Other": 200000,
    "ACC": 100000,
  };
  const depDaily = {
    "Mobile": mk(10000, 1000),
    "Laptop": mk(8000, 800),
    "Other": mk(6000, 600),
    "ACC": mk(4000, 400),
  };

  const { ctx, page } = await openWith(
    period,
    targets,
    depDaily,
    null,
    { width: 1280, height: 900 },
    "Mobile",
  );

  const totalTxt = await sectionText(page, "Mobile Group");
  check("B1 | قسم Mobile Group موجود", totalTxt !== "SECTION_NOT_FOUND");

  // Monthly Target = مجموع الأجزاء الأربعة
  const totalTarget = metric(totalTxt, "Monthly Target");
  check(
    "B2 | Monthly Target = 1,000,000 (مجموع الأربعة)",
    totalTarget === 1000000,
    `got=${totalTarget}`,
  );

  // جدول موحّد فيه الأجزاء الأربعة كأعمدة (بعد إعادة التسمية: Mobile/Laptop/Other/ACC)
  const hasAllCols = await page.evaluate(() => {
    const headers = [...document.querySelectorAll("main thead th")].map((h) => h.textContent?.trim());
    return (
      headers.some((h) => h === "Mobile") &&
      headers.some((h) => h === "Laptop") &&
      headers.some((h) => h === "Other") &&
      headers.some((h) => h === "ACC")
    );
  });
  check("B3 | أعمدة الأجزاء الأربعة في جدول موحّد", hasAllCols === true);

  // قسم واحد فقط (ليس قسماً لكل جزء)
  const secCount = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")].filter((s) => s.querySelector("h2"));
    return secs.length;
  });
  check("B4 | قسم واحد مجمّع (ليس 4 أقسام)", secCount === 1, `sections=${secCount}`);

  // Day Total = مجموع الأجزاء في اليوم الأخير (يوم 10: 10000+11000+12000+13000... حسب المعادلة)
  const lastRow = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("main tbody tr")];
    return rows.length ? rows[rows.length - 1].innerText.replace(/\n+/g, " | ") : "NO_ROWS";
  });
  // Telecom Mobile يوم 10: cum = Σ(10000+1000d) d=1..10 = 155000
  // IT Laptop: Σ(8000+800d) = 124000 ; IT Other: Σ(6000+600d) = 93000 ; ACC: Σ(4000+400d) = 62000
  // إجمالي اليوم 10 = (19000+16200+13400+10600)=59200
  check("B5 | Day Total يوم 10 = 56,000", lastRow.includes("56,000"), `row=${lastRow.slice(0, 160)}`);
  check("B6 | Cum يوم 10 = 434,000", lastRow.includes("434,000"), `row=${lastRow.slice(0, 160)}`);

  await ctx.close();
}

/* ============================================================
   C. صفحة MDA-SDA — نفس نظام TV-AC
   ============================================================ */
{
  const period = "2026-05"; // 31 يوم شهر سابق
  const mdaDaily = { [dstr(2026, 5, 10)]: 500000, [dstr(2026, 5, 20)]: 900000 };
  const sdaDaily = { [dstr(2026, 5, 10)]: 300000, [dstr(2026, 5, 20)]: 600000 };

  const { ctx, page } = await openWith(
    period,
    { MDA: 1500000, SDA: 900000 },
    { MDA: mdaDaily, SDA: sdaDaily },
    null,
    { width: 1280, height: 900 },
    "MDA - SDA",
  );

  const totalTxt = await sectionText(page, "MDA + SDA");
  check("C1 | قسم MDA + SDA موجود", totalTxt !== "SECTION_NOT_FOUND");

  const cum = metric(totalTxt, "Cum. Actual");
  check("C2 | Cum = 1,500,000 (آخر قراءة مجمعة)", cum === 1500000, `got=${cum}`);

  // Daily آخر صف = فرق القراءات: MDA=400k + SDA=300k = 700k
  const lastRow = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "MDA + SDA");
    const rows = sec ? [...sec.querySelectorAll("tbody tr")] : [];
    return rows.length ? rows[rows.length - 1].innerText.replace(/\n+/g, " | ") : "NO_ROWS";
  });
  check("C3 | Daily يوم 20 = 700,000 (فرق القراءات)", lastRow.includes("700,000"), `row=${lastRow.slice(0, 120)}`);

  // ثلاثة مستويات بالترتيب
  const orderOk = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const idx = (name) => secs.findIndex((s) => s.querySelector("h2")?.textContent?.trim() === name);
    return idx("MDA + SDA") === 0 && idx("MDA") > 0 && idx("SDA") > idx("MDA");
  });
  check("C4 | الترتيب: Total ← MDA ← SDA", orderOk === true);

  await ctx.close();
}

/* ============================================================
   D. Daily Editor — زر Edit + الحفظ + مبيعات اليوم التلقائي
   ============================================================ */
{
  const period = CUR_PERIOD;
  const [y, m] = period.split("-").map(Number);
  const date = dstr(y, m, 15); // التاريخ المختار للحفظ

  const { ctx, page } = await openWith(
    period,
    { TV: 1000000, AC: 0 },
    { TV: { [dstr(y, m, 12)]: 200000 } },
    null,
    { width: 1280, height: 900 },
    "Daily Editor",
  );

  // فتح شاشة المدير (كلمة السر من ADMIN_PASSWORD) — الوصول لصفحة Daily يتطلب Manager
  const needUnlock = await page.evaluate(() => document.body.innerText.includes("Manager Access Required"));
  if (needUnlock) {
    await page.locator('input[type="password"]').fill((process.env.ADMIN_PASSWORD ?? ""));
    await page.getByRole("button", { name: "Unlock Editor" }).click();
    await page.waitForTimeout(800);
  }

  // 1) الحقول مقفولة افتراضياً + زر Edit ظاهر
  const disabledBefore = await page.locator("main table input:not([disabled])").count();
  const editBtn = page.locator("main").getByRole("button", { name: "Edit", exact: true }).first();
  const editVisible = await editBtn.isVisible().catch(() => false);
  check("D1 | الحقول مقفولة افتراضياً", disabledBefore === 0, `enabled=${disabledBefore}`);
  check("D2 | زر Edit ظاهر", editVisible === true);

  // اختيار التاريخ 15 قبل فتح التعديل (تغيير التاريخ يقفل التعديل تلقائياً)
  await page.locator('input[type="date"]').fill(date);
  await page.waitForTimeout(600);

  // 2) الضغط على تعديل يفتح الحقول
  await page.locator("main").getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.waitForTimeout(500);
  const enabledAfter = await page.locator("main table input:not([disabled])").count();
  check("D3 | زر Edit يفتح الحقول", enabledAfter > 0, `enabled=${enabledAfter}`);

  // 3) إدخال قراءة تراكمية لليوم المختار: TV = 350,000 (السابقة 200,000 → اليوم=150,000)
  //    أول صف = TV
  // بعد حذف عمودي التارجيت: كل صف به مدخل واحد فقط (Actual) → nth(0) هو محقق TV
  const firstCumInput = page.locator("main table input").nth(0);
  await firstCumInput.fill("350000");

  // مبيعات اليوم التلقائي تظهر 150,000
  const depRow = page.locator("main table tbody tr").first();
  const rowTxt = await depRow.innerText();
  check(
    "D4 | مبيعات اليوم التلقائي = 150,000 (350k − 200k)",
    rowTxt.includes("150,000"),
    `row=${rowTxt.replace(/\n+/g, " | ").slice(0, 200)}`,
  );

  // 4) الحفظ يحفظ في التاريخ المختار
  await page.getByRole("button", { name: /حفظ|Save/ }).first().click();
  await page.waitForTimeout(1500);
  const savedState = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("fayoum-pcc-v2") || "{}");
    return st.departmentDailyActuals?.[st.period]?.TV ?? {};
  });
  check(
    "D5 | الحفظ في التاريخ المختار",
    savedState[date] === 350000,
    `stored=${JSON.stringify(savedState)}`,
  );

  // 5) بعد الحفظ الحقول تقفل من جديد
  await page.waitForTimeout(500);
  const disabledAfterSave = await page.locator("main table input:not([disabled])").count();
  check("D6 | الحفظ يقفل الحقول من جديد", disabledAfterSave === 0, `enabled=${disabledAfterSave}`);

  // 6) صفحة TV-AC تعكس القراءة: Cum TV = 350k و Daily = 150k
  await page.getByRole("button", { name: "TV — AC" }).first().click();
  await page.waitForTimeout(900);
  const tvTxt = await sectionText(page, "TV");
  const tvCum = metric(tvTxt, "Cum. Actual");
  if (CUR_TRACKDAY >= 15) {
    check(
      "D7 | TV-AC يعكس القراءة التراكمية 350,000",
      tvCum === 350000,
      `got=${tvCum} (trackDay=${CUR_TRACKDAY})`,
    );
  } else {
    check("D7 | متخلف (trackDay < 15)", true, "skipped");
  }

  await ctx.close();
}

/* ============================================================
   E. Overview — الدائرة + كروت CR/GK/Gift + جدول KPI
   ============================================================ */
{
  const period = CUR_PERIOD;
  const [y, m] = period.split("-").map(Number);
  const branchDaily = {
    CR: { [dstr(y, m, 10)]: 16 },
    GK: { [dstr(y, m, 10)]: 300 },
    Gift: { [dstr(y, m, 10)]: 50 },
    Agency: { [dstr(y, m, 10)]: 10 },
  };

  const { ctx, page } = await openWith(
    period,
    { TV: 1000000, AC: 500000 },
    { TV: { [dstr(y, m, 5)]: 200000 } },
    branchDaily,
    { width: 1280, height: 900 },
    "Overview",
  );

  // كروت CR/GK/Gift موجودة في قسم Branch Target
  const miniCards = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) =>
      s.querySelector("h2")?.textContent?.trim() === "Branch Target",
    );
    return sec ? sec.innerText : "NOT_FOUND";
  });
  check("E1 | كروت CR و GK و Gift في قسم Branch Target", ["CR", "GK", "Gift"].every((k) => miniCards.includes(k)));

  // CR: التارجيت 20% والمحقق 16% والنسبة 80%
  check("E2 | CR: target 20% محقق 16% نسبة 80%", miniCards.includes("20%") && miniCards.includes("16%") && miniCards.includes("80%"), miniCards.slice(0, 400));
  // GK: تارجيت 400 ومحقق 300 والنسبة 75%
  check("E3 | GK: target 400 محقق 300 نسبة 75%", miniCards.includes("400") && miniCards.includes("300") && miniCards.includes("75%"));

  // كلمات الحالة ظاهرة في الكروت
  check("E4 | كلمة حالة بجانب كل كارت", /Excellent|Good|Will Do|Danger/.test(miniCards));

  // جدول Main KPI: CR/GK/Gift محذوفون منه
  const tableKpis = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) =>
      s.querySelector("h2")?.textContent?.trim() === "Main KPI performance",
    );
    return sec ? sec.innerText : "NOT_FOUND";
  });
  check(
    "E5 | CR/GK/Gift محذوفون من جدول KPI",
    !/\bCR\b/.test(tableKpis) && !/\bGK\b/.test(tableKpis) && !/Gift/.test(tableKpis),
    tableKpis.slice(0, 150),
  );
  check("E6 | جدول KPI يحتوي Gross/Agency/Boxi/Mylo", ["Gross", "Agency", "Boxi", "Mylo"].every((k) => tableKpis.includes(k)));

  // عمود KPI محاذي لليسار
  const kpiLeft = await page.evaluate(() => {
    const td = [...document.querySelectorAll("main tbody td")].find((c) => c.textContent?.trim() === "Gross");
    return td ? td.className.includes("text-left") : false;
  });
  check("E7 | عمود KPI محاذي لليسار", kpiLeft === true);

  // ألوان النسب في جدول KPI
  const pctColored = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("main tbody tr")];
    const gross = rows.find((r) => r.textContent?.trim().startsWith("Gross"));
    if (!gross) return false;
    const cells = [...gross.querySelectorAll("td")];
    const pctCell = cells[cells.length - 2];
    return /text-(emerald|success|warning|danger)/.test(pctCell.className);
  });
  check("E8 | نسبة KPI ملونة حسب الحالة", pctColored === true);

  // الأقسام الثلاثة: كل قسم في سطر
  const sectionsRows = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) =>
      s.querySelector("h2")?.textContent?.trim() === "Sales Sections",
    );
    return sec ? sec.innerText : "NOT_FOUND";
  });
  check("E9 | سطور الأقسام (Mobile/MDA/TV) ظاهرة", ["Mobile", "MDA + SDA", "TV + AC"].every((g) => sectionsRows.includes(g)));

  // الدائرة + الإحصائيات بجانب بعض (أفقي على كل المقاسات)
  const sideBySide = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) =>
      s.querySelector("h2")?.textContent?.trim() === "Branch Target",
    );
    if (!sec) return false;
    const svg = sec.querySelector("svg");
    if (!svg) return false;
    // الإحصائيات (StatRow) في حاوية مستقلة بجانب الدائرة
    const wrap = svg.closest("div.flex.items-center.justify-center");
    if (!wrap) return false;
    const statsBox = wrap.querySelector("div.flex.w-full.max-w-sm.flex-col, div.flex.flex-col:has(> div.rounded-xl)");
    if (!statsBox) return false;
    // أفقية فعلية: الدائرة والإحصائيات متجاوران دون تداخل
    const svgR = svg.getBoundingClientRect();
    const sR = statsBox.getBoundingClientRect();
    const overlap = Math.min(svgR.right, sR.right) - Math.max(svgR.left, sR.left);
    const sameRow = Math.abs(svgR.top - sR.top) < Math.max(svgR.height, sR.height);
    return overlap <= 2 && sameRow;
  });
  check("E10 | الدائرة والإحصائيات بجانب بعضها", sideBySide === true);

  await ctx.close();
}

/* ============================================================
   F. الشهور 28/29/30/31 + حدود الأنصافة + الموبايل
   ============================================================ */
{
  // شهر 28 يوم
  const r28 = await openWith("2026-02", { TV: 280000, AC: 0 }, {}, null, { width: 1280, height: 900 }, "TV — AC");
  const t28 = await sectionText(r28.page, "TV + AC");
  check("F1 | شهر 28 يوم: Daily = 10,000", metric(t28, "Daily Target") === 10000, `got=${metric(t28, "Daily Target")}`);
  check("F1b | شهر 28: Checkpoint80 = 120,000 (80% من 150,000)", t28.includes("120,000"), t28.slice(0, 300));
  await r28.ctx.close();

  // شهر 29 يوم (كبيسة 2028)
  const r29 = await openWith("2028-02", { TV: 290000, AC: 0 }, {}, null, { width: 1280, height: 900 }, "TV — AC");
  const t29 = await sectionText(r29.page, "TV + AC");
  check("F2 | شهر 29 يوم: Daily = 10,000", metric(t29, "Daily Target") === 10000, `got=${metric(t29, "Daily Target")}`);
  await r29.ctx.close();

  // شهر 31 يوم مع قراءات حول حدود الأنصافة
  const marDaily = {
    TV: { [dstr(2026, 3, 15)]: 500000, [dstr(2026, 3, 16)]: 560000, [dstr(2026, 3, 31)]: 800000 },
    AC: { [dstr(2026, 3, 15)]: 300000, [dstr(2026, 3, 16)]: 340000, [dstr(2026, 3, 31)]: 500000 },
  };
  const r31 = await openWith(
    "2026-03",
    { TV: 620000, AC: 620000 },
    marDaily,
    null,
    { width: 1280, height: 900 },
    "TV — AC",
  );
  const t31 = await sectionText(r31.page, "TV + AC");
  // Cum = آخر قراءة مجمعة = 1,300,000
  check("F3 | شهر 31: Cum = 1,300,000", metric(t31, "Cum. Actual") === 1300000, `got=${metric(t31, "Cum. Actual")}`);
  // H1 = آخر قراءة داخل 15 = 800,000 (مثبّت)
  const h1Txt = await r31.page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
    const h1 = sec ? [...sec.querySelectorAll("section")].find((c) => c.querySelector("h3")?.textContent?.trim() === "Half 1") : null;
    return h1 ? h1.innerText.replace(/\n+/g, " | ") : "NOT_FOUND";
  });
  check("F4 | H1 مثبّت = 800,000 (قراءة يوم 15)", metric(h1Txt, "Actual") === 800000, `got=${metric(h1Txt, "Actual")}`);
  // H2 = 1,300,000 − 800,000 = 500,000
  const h2Txt = await r31.page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => s.querySelector("h2")?.textContent?.trim() === "TV + AC");
    const h2 = sec ? [...sec.querySelectorAll("section")].find((c) => c.querySelector("h3")?.textContent?.trim() === "Half 2") : null;
    return h2 ? h2.innerText.replace(/\n+/g, " | ") : "NOT_FOUND";
  });
  check("F5 | H2 = 500,000 (Cum − H1)", metric(h2Txt, "Actual") === 500000, `got=${metric(h2Txt, "Actual")}`);
  // Checkpoint 85% من h2Target: h2Target = 1,240,000/31*16 = 640,000 → 85% = 544,000
  check("F6 | Checkpoint85 = 544,000", h2Txt.includes("544,000"), h2Txt.slice(0, 260));
  await r31.ctx.close();

  // الموبايل 390px — صفحة TV-AC و Mobile و Overview بلا سكرول أفقي
  for (const [nav, name] of [["TV·AC", "tvac"], ["Mobile", "mobile"], ["Home", "home"]]) {
    const r = await openWith(CUR_PERIOD, { TV: 1200000, AC: 800000 }, {}, null, { width: 390, height: 844 }, nav);
    const overflow = await r.page.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
    }));
    check(`F7 | لا سكرول أفقي ${name} 390px`, overflow.s <= overflow.c + 1, `scroll=${overflow.s} client=${overflow.c}`);
    await r.ctx.close();
  }
}

/* ============================================================
   G. الحفظ من Daily Editor ينعكس فوراً على صفحة Mobile و MDA-SDA (عبر الحقنة)
   ============================================================ */
{
  const period = "2026-06";
  const depDaily = {
    "Mobile": { [dstr(2026, 6, 8)]: 100000, [dstr(2026, 6, 20)]: 180000 },
    "Laptop": { [dstr(2026, 6, 8)]: 50000, [dstr(2026, 6, 20)]: 90000 },
    "Other": { [dstr(2026, 6, 8)]: 20000, [dstr(2026, 6, 20)]: 40000 },
    "ACC": { [dstr(2026, 6, 8)]: 10000, [dstr(2026, 6, 20)]: 20000 },
  };
  const r = await openWith(
    period,
    { "Mobile": 500000, "Laptop": 400000, "Other": 300000, "ACC": 200000 },
    depDaily,
    null,
    { width: 1280, height: 900 },
    "Mobile",
  );
  const txt = await sectionText(r.page, "Mobile Group");
  // آخر قراءة مجمعة (يوم 20): 180+90+40+20 = 330,000
  check("G1 | Mobile Cum = 330,000", metric(txt, "Cum. Actual") === 330000, `got=${metric(txt, "Cum. Actual")}`);
  // Daily يوم 20 = (80+40+20+10) = 150,000
  const lastRow = await r.page.evaluate(() => {
    const rows = [...document.querySelectorAll("main tbody tr")];
    return rows.length ? rows[rows.length - 1].innerText.replace(/\n+/g, " | ") : "NO_ROWS";
  });
  check("G2 | Mobile Daily يوم 20 = 150,000", lastRow.includes("150,000"), `row=${lastRow.slice(0, 160)}`);
  await r.ctx.close();
}

await browser.close();

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log("\n" + results.join("\n"));
console.log(`\nالنتيجة: ${results.length - failed.length}/${results.length} ناجح`);
if (failed.length) {
  console.log("\nفشل:");
  failed.forEach((f) => console.log("  " + f));
  process.exit(1);
}

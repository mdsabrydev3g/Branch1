import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));

await page.goto("http://localhost:8080", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

let fail = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${extra ? ` (${extra})` : ""}`);
  if (!ok) fail++;
}

const ov = await page.evaluate(() => document.body.innerText);

// أسماء قديمة يجب ألا تظهر في أي مكان
for (const bad of ["IT Laptop", "IT Other", "Telecom Mobile", "Telecom ACC"]) {
  check(`Overview خالٍ من "${bad}"`, !ov.includes(bad));
}

// صفحة TV-AC
await page.getByRole("button", { name: "TV — AC" }).first().click();
await page.waitForTimeout(1200);
const tv = await page.evaluate(() => document.body.innerText);
check("TV-AC خالٍ من Television desk", !tv.includes("Television desk"));
check("TV-AC خالٍ من Air-conditioning desk", !tv.includes("Air-conditioning desk"));

// صفحة MDA-SDA
await page.getByRole("button", { name: "MDA - SDA" }).first().click();
await page.waitForTimeout(1200);
const mda = await page.evaluate(() => document.body.innerText);
check("MDA-SDA خالٍ من Major domestic appliances", !mda.includes("Major domestic appliances"));
check("MDA-SDA خالٍ من Small domestic appliances", !mda.includes("Small domestic appliances"));

// صفحة Mobile
await page.getByRole("button", { name: "Mobile" }).first().click();
await page.waitForTimeout(1200);
const mob = await page.evaluate(() => document.body.innerText);
// عناوين الجدول تُعرض بأحرف كبيرة (CSS uppercase) — قارن بدون حساسية للحالة
const mobLower = mob.toLowerCase();
for (const good of ["Laptop", "Other", "Mobile", "ACC"]) {
  check(`Mobile يعرض "${good}"`, mobLower.includes(good.toLowerCase()));
}
// السطر التحت العنوان أُزيل حسب الطلب — التسميات موجودة في عناوين الجدول
for (const bad of ["IT Laptop", "IT Other", "Telecom Mobile", "Telecom ACC", "Laptops and related", "IT accessories", "Mobile handsets", "Mobile accessories"]) {
  check(`Mobile خالٍ من "${bad}"`, !mobLower.includes(bad.toLowerCase()));
}

// Daily Editor: الأسماء الجديدة ولا يوجد شرح
await page.getByRole("button", { name: "Daily Editor" }).click();
await page.waitForTimeout(1500);
const unlock = page.locator("main").getByRole("button", { name: "Unlock Editor" });
if (await unlock.isVisible({ timeout: 3000 }).catch(() => false)) {
  await page.locator("main input[type='password']").fill("Fay1");
  await unlock.click();
  await page.waitForTimeout(800);
}
const de = await page.evaluate(() => document.body.innerText);
for (const good of ["Laptop", "Other", "Mobile", "ACC"]) {
  check(`Daily Editor يعرض "${good}"`, de.includes(good));
}
for (const bad of ["IT Laptop", "IT Other", "Telecom Mobile", "Telecom ACC", "Television desk", "Air-conditioning desk", "Major domestic", "Small domestic", "Laptops and related", "IT accessories", "Mobile handsets", "Mobile accessories"]) {
  check(`Daily Editor خالٍ من "${bad}"`, !de.includes(bad));
}

// Reports
await page.getByRole("button", { name: "Report" }).first().click();
await page.waitForTimeout(1200);
const rep = await page.evaluate(() => document.body.innerText);
check("Reports يعرض Laptop", rep.includes("Laptop"));
check("Reports خالٍ من Television desk", !rep.includes("Television desk"));
check("Reports خالٍ من Air-conditioning desk", !rep.includes("Air-conditioning desk"));

console.log("\nconsole errors:", errs.length);
errs.forEach((e) => console.log(" -", e));
console.log(fail === 0 ? "\n✅ الكل سليم" : `\n✗ ${fail} فشل`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);

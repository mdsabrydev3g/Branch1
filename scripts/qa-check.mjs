// Temporary QA pass: seeds realistic data through the Daily Editor (manager
// mode), then walks all views at desktop + mobile widths asserting the
// first-half override figures, track-based index, second-half subtraction and
// per-date entry loading. Local PGLite is in-memory, so seeds vanish on restart.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
const OUT = "screenshots/qa";
mkdirSync(OUT, { recursive: true });

const errors = [];
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// Seed data (matches the user's real scenario): cumulative actuals per dep.
// Day-18 (today) cumulative and day-17 cumulative. Group sums on day 17 match
// the manager-provided first-half figures (728,466 / 2,571,348 / 5,501,737).
const TARGETS = {
  TV: 1100000, AC: 950000, MDA: 3300000, SDA: 1900000,
  "Laptop": 4900000, "Other": 1600000, "Mobile": 3500000, "ACC": 1690000,
}; // Σ = 18,940,000 → track(17 days) = 10,732,667 → 9,160,000 actual ≈ 85%
const DAY18 = {
  TV: 450000, AC: 360000, MDA: 1600000, SDA: 1060000,
  "Laptop": 3300000, "Other": 720000, "Mobile": 1150000, "ACC": 520000,
}; // Σ = 9,160,000; TV-AC 810,000 / MDA-SDA 2,660,000 / Mobile 5,690,000
const DAY17 = {
  TV: 400000, AC: 328466, MDA: 1543874, SDA: 1027474,
  "Laptop": 3201737, "Other": 700000, "Mobile": 1100000, "ACC": 500000,
}; // Σ = 8,801,551
const DEP_ORDER = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];

const browser = await chromium.launch();

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return { context, page };
}

async function gotoNav(page, label, shot, mobile = false) {
  const btn = mobile
    ? page.locator("nav.fixed button", { hasText: label }).first()
    : page.locator("button", { hasText: label }).first();
  await btn.click();
  await page.waitForTimeout(700);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

async function unlockManager(page) {
  await gotoNav(page, "Daily Editor");
  const pw = page.locator('input[type="password"]').first();
  if (await pw.count()) {
    await pw.fill((process.env.ADMIN_PASSWORD ?? ""));
    await page.locator('button:has-text("Unlock Editor")').click();
    await page.waitForTimeout(600);
  }
}

async function fillDepTable(page, actuals) {
  const targetInputs = page.locator('tbody input.w-28');
  const actualInputs = page.locator('tbody input.w-32');
  for (let i = 0; i < DEP_ORDER.length; i++) {
    const dep = DEP_ORDER[i];
    await targetInputs.nth(i).fill(String(TARGETS[dep]));
    await actualInputs.nth(i).fill(actuals[dep] ? String(actuals[dep]) : "");
  }
  await page.locator('button:has-text("Save & Sync All")').click();
  await page.waitForTimeout(1500);
}

const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, "0");
const todayStr = `${y}-${m}-${String(today.getDate()).padStart(2, "0")}`;
const day17 = `${y}-${m}-17`;
const day15 = `${y}-${m}-15`;

// ---------- Desktop: seed + verify ----------
{
  const { context, page } = await newPage(1440, 900);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/overview-desktop.png`, fullPage: true });

  await unlockManager(page);
  // Seed targets + day-18 cumulative actuals
  await fillDepTable(page, DAY18);
  // Seed day-17 cumulative actuals
  await page.locator('input[type="date"]').first().fill(day17);
  await page.waitForTimeout(600);
  await fillDepTable(page, DAY17);

  // Per-date loading: day 17 shows day-17 entries
  const tvActual17 = await page.locator('tbody input.w-32').nth(0).inputValue();
  check("daily editor: day-17 selection loads day-17 entries", tvActual17 === "400000", `TV=${tvActual17}`);

  // Day 15 has no entries → fields empty
  await page.locator('input[type="date"]').first().fill(day15);
  await page.waitForTimeout(600);
  const tvActual15 = await page.locator('tbody input.w-32').nth(0).inputValue();
  check("daily editor: day-15 (no entries) shows empty", tvActual15 === "", `TV="${tvActual15}"`);
  await page.screenshot({ path: `${OUT}/daily-day15-desktop.png`, fullPage: true });

  // Back to today → day-18 entries
  await page.locator('input[type="date"]').first().fill(todayStr);
  await page.waitForTimeout(600);
  const tvActual18 = await page.locator('tbody input.w-32').nth(0).inputValue();
  check("daily editor: today selection loads day-18 entries", tvActual18 === "450000", `TV=${tvActual18}`);
  const actualHeader = await page.locator('th:has-text("Actual")').count();
  const cumulativeHeader = await page.locator('th:has-text("المحقق التراكمي")').count();
  check("daily editor: header 'Actual', no 'المحقق التراكمي'", actualHeader >= 1 && cumulativeHeader === 0);
  await page.screenshot({ path: `${OUT}/daily-desktop.png`, fullPage: true });

  // Overview: branch % = actual ÷ track
  await gotoNav(page, "Overview", "overview-seeded-desktop");
  const bodyText = await page.locator("body").textContent();
  check("overview: branch shows 85% (actual ÷ track)", bodyText.includes("85%"), "");
  await page.screenshot({ path: `${OUT}/overview-final-desktop.png`, fullPage: true });

  // Reports
  await gotoNav(page, "Reports", "reports-desktop");
  const reportsText = await page.locator("body").textContent();
  check("reports: first-half actual 8,801,551", (await page.getByText("8,801,551").count()) >= 1);
  check("reports: second-half actual = cumulative − first half (358,449)", reportsText.includes("358,449"), "");
  check("reports: 80%/85% milestone actual = cumulative 9,160,000", (await page.getByText("9,160,000").count()) >= 3, `count=${await page.getByText("9,160,000").count()}`);
  check("reports: index 85% like overview", reportsText.includes("85%"), "");
  check("reports: status word 'Will Do' present", reportsText.includes("Will Do"), "");
  check("reports: Gross KPI falls back to dept totals (18,940,000)", (await page.getByText("18,940,000").count()) >= 2, `count=${await page.getByText("18,940,000").count()}`);
  await page.screenshot({ path: `${OUT}/reports-final-desktop.png`, fullPage: true });

  // Department pages
  await gotoNav(page, "TV — AC", "tvac-desktop");
  const tvacText = await page.locator("body").textContent();
  check("tv-ac: first-half 728,466", (await page.getByText("728,466").count()) > 0);
  check("tv-ac: second half = 810,000 − 728,466 = 81,534", tvacText.includes("81,534"), "");
  check("tv-ac: 85% milestone card shown", (await page.getByText("85% milestone").count()) > 0);
  check("tv-ac: 85% target = 0.85 × 2,050,000 = 1,742,500", tvacText.includes("1,742,500"), "");
  check("tv-ac: 85% actual = cumulative 810,000", (await page.getByText("810,000").count()) > 0);
  await page.screenshot({ path: `${OUT}/tvac-final-desktop.png`, fullPage: true });

  await gotoNav(page, "MDA - SDA", "mdasda-desktop");
  const mdasdaText = await page.locator("body").textContent();
  check("mda-sda: first-half 2,571,348", (await page.getByText("2,571,348").count()) > 0);
  check("mda-sda: second half = 2,660,000 − 2,571,348 = 88,652", mdasdaText.includes("88,652"), "");

  await gotoNav(page, "Mobile", "mobilegroup-desktop");
  const mobileText = await page.locator("body").textContent();
  check("mobile: first-half 5,501,737", (await page.getByText("5,501,737").count()) > 0);
  check("mobile: second half = 5,690,000 − 5,501,737 = 188,263", mobileText.includes("188,263"), "");

  await context.close();
}

// ---------- Mobile 390×844 (fresh page, same seeded server data) ----------
{
  const { context, page } = await newPage(390, 844);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  await gotoNav(page, "Report", "reports-mobile", true);
  check("mobile reports: 8,801,551 rendered", (await page.getByText("8,801,551").count()) > 0);

  await gotoNav(page, "TV·AC", "tvac-mobile", true);
  check("mobile tv-ac: 728,466 rendered", (await page.getByText("728,466").count()) > 0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("mobile tv-ac: no horizontal overflow", overflow <= 1, `overflowPx=${overflow}`);

  await gotoNav(page, "MDA·SDA", "mdasda-mobile", true);
  check("mobile mda-sda: 2,571,348 rendered", (await page.getByText("2,571,348").count()) > 0);

  await gotoNav(page, "Mobile", "mobilegroup-mobile", true);
  check("mobile group: 5,501,737 rendered", (await page.getByText("5,501,737").count()) > 0);

  await context.close();
}

await browser.close();

console.log("\n---- console/page errors ----");
console.log(errors.length ? errors.join("\n") : "(none)");
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(errors.length || failed ? 1 : 0);

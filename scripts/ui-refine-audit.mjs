#!/usr/bin/env node
/**
 * UI audit for the header + "Main KPI performance" table.
 *
 *   node scripts/ui-refine-audit.mjs [url]
 *
 * Prints a JSON verdict per (theme × viewport) and writes screenshots to
 * screenshots/ui-<theme>-<width>.png (full page) plus
 * screenshots/ui-<theme>-<width>-header.png (header + table clip).
 * Read-only: never writes to the app or the database.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const url = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:8080/";
const OUT_DIR = "screenshots";
/** `--widths=1440,390` / `--themes=dark` narrow the sweep while iterating. */
const argList = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).split(",") : fallback;
};
const WIDTHS = argList("widths", ["1920", "1440", "1280", "1024", "768", "430", "390", "375"]).map(Number);
const THEMES = argList("themes", ["dark", "light"]);
const TAG = process.env.UI_AUDIT_TAG ? `${process.env.UI_AUDIT_TAG}-` : "";
/** `--stress` rewrites every KPI number to its widest realistic value (10 chars)
    before measuring, so clipping shows up even on a month with no data yet. */
const STRESS = process.argv.includes("--stress");

/** Runs inside the browser: worst-case numbers inside the Main KPI section only. */
function stressNumbers() {
  const h2 = [...document.querySelectorAll("h2")].find((n) =>
    n.textContent?.toLowerCase().includes("main kpi"),
  );
  const section = h2?.closest("section");
  if (!section) return 0;
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let n = 0;
  for (const node of nodes) {
    const t = node.nodeValue.trim();
    if (node.parentElement?.closest("select")) continue;
    if (/^[\d,]+$/.test(t)) {
      node.nodeValue = "88,888,888";
      n++;
    } else if (/^\d+(\.\d+)?%$/.test(t)) {
      node.nodeValue = "100%";
      n++;
    }
  }
  return n;
}


mkdirSync(OUT_DIR, { recursive: true });

/** Runs inside the browser: header alignment + table fit measurements. */
function measure() {
  const r = (n) => Math.round(n * 10) / 10;
  const header = document.querySelector("header");
  const hr = header?.getBoundingClientRect();
  const cs = header ? getComputedStyle(header) : null;
  const center = hr ? hr.top + hr.height / 2 : 0;

  const controls = [];
  const KIND = { IMG: "logo", BUTTON: "button", SELECT: "month" };
  for (const el of header ? header.querySelectorAll("img,button,select") : []) {
    const b = el.getBoundingClientRect();
    if (!b.height || !b.width) continue;
    controls.push({
      kind: KIND[el.tagName] ?? el.tagName,
      label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20),
      h: r(b.height),
      centerDelta: r(b.top + b.height / 2 - center),
    });
  }

  const h2 = [...document.querySelectorAll("h2")].find((n) =>
    n.textContent?.toLowerCase().includes("main kpi"),
  );
  const section = h2?.closest("section") ?? null;
  const table = section?.querySelector("table") ?? null;
  const tb = table?.getBoundingClientRect();
  const heads = table
    ? [...table.querySelectorAll("thead th")].map((th) => {
        const b = th.getBoundingClientRect();
        return {
          text: th.textContent.trim(),
          w: r(b.width),
          pct: tb ? r((b.width / tb.width) * 100) : 0,
          align: getComputedStyle(th).textAlign,
        };
      })
    : [];

  const clipped = [];
  for (const cell of table ? table.querySelectorAll("th,td") : []) {
    if (cell.scrollWidth > cell.clientWidth + 1) {
      clipped.push({
        text: cell.textContent.trim().slice(0, 16),
        client: cell.clientWidth,
        scroll: cell.scrollWidth,
      });
    }
  }

  // أي عنصر داخل قسم Main KPI يفيض عن إطاره — يغطي تخطيط الموبايل (الكروت)
  // حيث يكون `<table>` مخفياً تماماً فلا تكفي قياسات الخلايا.
  const sectionClipped = [];
  for (const el of section ? section.querySelectorAll("*") : []) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      sectionClipped.push({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 18),
        client: el.clientWidth,
        scroll: el.scrollWidth,
      });
    }
  }

  // Branch Target section (CR/GK/Gift cards) — same clipping check.
  const btH2 = [...document.querySelectorAll("h2")].find((n) =>
    n.textContent?.toLowerCase().includes("branch target"),
  );
  const btSection = btH2?.closest("section") ?? null;
  const branchClipped = [];
  for (const el of btSection ? btSection.querySelectorAll("*") : []) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      branchClipped.push({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 18),
        client: el.clientWidth,
        scroll: el.scrollWidth,
      });
    }
  }

  const de = document.documentElement;
  const row = table?.querySelector("tbody tr");
  const mobileCard = section?.querySelector(".sm\\:hidden > div");
  const kpiRowH = r(
    row?.getBoundingClientRect().height || mobileCard?.getBoundingClientRect().height || 0,
  );
  return {
    kpiRowH,
    viewport: { w: de.clientWidth, h: window.innerHeight },
    pageOverflowX: r(de.scrollWidth - de.clientWidth),
    bodyOverflowX: r(document.body.scrollWidth - document.body.clientWidth),
    header: hr
      ? { h: r(hr.height), padTop: cs.paddingTop, padBottom: cs.paddingBottom }
      : null,
    controls,
    table: tb
      ? {
          w: r(tb.width),
          h: r(tb.height),
          overflowX: table.scrollWidth - table.clientWidth,
          sectionOverflowX: section.scrollWidth - section.clientWidth,
          leftGap: r(tb.left),
          rightGap: r(de.clientWidth - tb.right),
          cellFont: row ? getComputedStyle(row.querySelector("td")).fontSize : null,
          cellPadX: row ? getComputedStyle(row.querySelector("td")).paddingLeft : null,
          tbodyAligns: row
            ? [...row.children].map((td) => getComputedStyle(td).textAlign)
            : [],
        }
      : null,
    heads,
    clipped,
    sectionClipped,
    branchClipped,
  };
}

const browser = await chromium.launch({ headless: true });
const report = {};
try {
  for (const theme of THEMES) {
    const ctx = await browser.newContext();
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("f1-theme", t);
      } catch {
        /* private mode */
      }
    }, theme);
    for (const width of WIDTHS) {
      const page = await ctx.newPage();
      const height = width < 700 ? 844 : 900;
      await page.setViewportSize({ width, height });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 110)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 110));
      });
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForSelector("header", { timeout: 15000 });
        await page.waitForTimeout(1200);
        if (STRESS) await page.evaluate(stressNumbers);
        const data = await page.evaluate(measure);
        const base = join(OUT_DIR, `ui-${TAG}${theme}-${width}`);
        await page.screenshot({ path: `${base}.png`, fullPage: true });
        const kpiSection = page.locator("section", {
          has: page.locator('h2:has-text("Main KPI performance")'),
        });
        if (await kpiSection.count()) {
          await kpiSection
            .first()
            .screenshot({ path: `${base}-kpi.png` })
            .catch(() => {});
        }
        const branchSection = page.locator("section", {
          has: page.locator('h2:has-text("Branch Target")'),
        });
        if (await branchSection.count()) {
          await branchSection
            .first()
            .screenshot({ path: `${base}-branch.png` })
            .catch(() => {});
        }
        const clipH = Math.min(height, 700);
        await page.screenshot({
          path: `${base}-header.png`,
          clip: { x: 0, y: 0, width, height: clipH },
        });
        report[`${theme}-${width}`] = { ...data, errors: [...new Set(errors)].slice(0, 3) };
      } catch (err) {
        report[`${theme}-${width}`] = { error: String(err?.message || err).slice(0, 160) };
      }
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 1));

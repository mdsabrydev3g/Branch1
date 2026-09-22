#!/usr/bin/env node
/**
 * Measures the real geometry of the header + Main KPI table at many viewports,
 * in both themes: vertical centering offsets, and any horizontal overflow.
 */
import { chromium } from "playwright";

const URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8080/";
const WIDTHS = [1920, 1440, 1280, 1024, 768, 430, 390, 375];

function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

async function measure(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const hBox = header?.getBoundingClientRect();
    const items = [...(header?.querySelectorAll("button, select, img, a") ?? [])]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const b = el.getBoundingClientRect();
        return { tag: el.tagName, label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 18),
                 top: Math.round(b.top - hBox.top), bottom: Math.round(hBox.bottom - b.bottom) };
      });
    // First KPI table on the overview page
    const table = document.querySelector("table");
    const tBox = table?.getBoundingClientRect();
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    return {
      header: hBox ? { h: Math.round(hBox.height) } : null,
      items,
      table: tBox ? { w: Math.round(tBox.width), over: Math.round(tBox.right - docW) } : null,
      docW, scrollW, overflowX: scrollW > docW,
    };
  });
}

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem("f1-theme", t); } catch {} }, theme);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    const m = await measure(page);
    const tops = m.items.map((i) => i.top), bots = m.items.map((i) => i.bottom);
    const spread = m.items.length ? Math.max(...tops) - Math.min(...tops) : 0;
    console.log(`${theme.padEnd(5)} ${String(w).padStart(4)}px | hdr ${m.header?.h ?? "?"}px | itemΔtop ${spread}px | tbl ${m.table?.w ?? "-"}px over ${m.table?.over ?? "-"} | docOverflow ${m.overflowX} (${m.scrollW}/${m.docW})`);
    await page.close();
  }
}
await browser.close();

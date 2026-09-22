import { chromium } from "playwright";
const browser = await chromium.launch();
for (const { t, w } of [{ t: "dark", w: 1440 }, { t: "dark", w: 390 }]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.addInitScript((th) => { try { localStorage.setItem("f1-theme", th); } catch {} }, t);
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const header = document.querySelector("header");
    const hb = header.getBoundingClientRect();
    const out = { headerH: Math.round(hb.height), items: [] };
    header.querySelectorAll("button, select, img").forEach((el) => {
      if (el.offsetParent === null) return;
      const b = el.getBoundingClientRect();
      out.items.push({
        what: (el.getAttribute("aria-label") || el.alt || el.textContent || "").trim().slice(0, 16),
        h: Math.round(b.height),
        top: Math.round(b.top - hb.top),
        bot: Math.round(hb.bottom - b.bottom),
      });
    });
    // table cell detail
    const tbl = document.querySelector("table");
    if (tbl) {
      const ths = [...tbl.querySelectorAll("th")].map((th) => ({
        txt: th.textContent.trim(), w: Math.round(th.getBoundingClientRect().width),
        align: getComputedStyle(th).textAlign,
      }));
      const row = tbl.querySelector("tbody tr");
      const tds = row ? [...row.querySelectorAll("td")].map((td) => ({
        txt: td.textContent.trim().slice(0, 8), w: Math.round(td.getBoundingClientRect().width),
        align: getComputedStyle(td).textAlign,
        fs: getComputedStyle(td).fontSize,
      })) : [];
      out.table = { cols: ths, firstRow: tds, tblW: Math.round(tbl.getBoundingClientRect().width) };
    }
    return out;
  });
  console.log(`\n=== ${t} @ ${w}px ===`);
  console.log("header h:", m.headerH);
  m.items.forEach((i) => console.log(`  ${(i.what||"?").padEnd(16)} h=${String(i.h).padStart(3)} top=${String(i.top).padStart(3)} bottom=${String(i.bot).padStart(3)}`));
  if (m.table) {
    console.log("  table w:", m.table.tblW);
    m.table.cols.forEach((c) => console.log(`    th "${c.txt}" w=${c.w} align=${c.align}`));
    m.table.firstRow.forEach((c) => console.log(`    td "${c.txt}" w=${c.w} align=${c.align} fs=${c.fs}`));
  }
  await page.close();
}
await browser.close();

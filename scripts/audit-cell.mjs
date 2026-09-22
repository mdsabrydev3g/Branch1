import { chromium } from "playwright";
const browser = await chromium.launch();
for (const w of [375, 390, 768, 1280]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const tbl = document.querySelector("table");
    if (!tbl) return null;
    const sec = tbl.closest("section");
    const secPad = sec ? getComputedStyle(sec) : null;
    let overflow = 0, worst = "";
    tbl.querySelectorAll("td, th").forEach((c) => {
      const cw = c.getBoundingClientRect().width;
      // measure the widest inline content
      const inner = c.querySelector("span") || c;
      const iw = inner.scrollWidth;
      if (iw > cw + 0.5 && iw - cw > overflow) { overflow = iw - cw; worst = c.textContent.trim().slice(0,14); }
    });
    return {
      tblW: Math.round(tbl.getBoundingClientRect().width),
      secPad: secPad ? secPad.padding + " / " + secPad.paddingLeft : "?",
      overflow: Math.round(overflow), worst,
      main: getComputedStyle(document.querySelector("main")).padding,
    };
  });
  console.log(`${w}px | tbl=${m.tblW} pad=(${m.secPad}) cellOverflow=${m.overflow}px worst="${m.worst}" mainPad=${m.main}`);
  await page.close();
}
await browser.close();

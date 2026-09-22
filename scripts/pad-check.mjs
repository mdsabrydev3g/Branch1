import { chromium } from "playwright";
const browser = await chromium.launch();
for (const w of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const p = await page.evaluate(() => {
    const h = document.querySelector("header");
    const cs = getComputedStyle(h);
    return { pt: cs.paddingTop, pb: cs.paddingBottom, h: cs.height,
             innerH: h.firstElementChild ? getComputedStyle(h.firstElementChild).height : null };
  });
  console.log(`${w}px: padTop=${p.pt} padBottom=${p.pb} headerH=${p.h} innerH=${p.innerH}`);
  await page.close();
}
await browser.close();

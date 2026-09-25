#!/usr/bin/env node
/**
 * Regenerates the mobile app icons (Android launcher/round/adaptive foreground
 * + iOS AppIcon) from the single source of truth: apps/desktop/src-tauri/icon.svg.
 *
 * Usage:
 *   PLAYWRIGHT_CHROMIUM_PATH="<chrome exe>" node scripts/generate-app-icons.mjs
 *
 * Outputs (committed to git, copied into the generated platform projects by CI):
 *   apps/mobile/android-icons/mipmap-DENSITY/ic_launcher.png
 *   apps/mobile/android-icons/mipmap-DENSITY/ic_launcher_round.png
 *   apps/mobile/android-icons/mipmap-DENSITY/ic_launcher_foreground.png
 *   apps/mobile/android-icons/ic_launcher_background.xml   (adaptive background colour)
 *   apps/mobile/ios-icons/AppIcon-512@2x.png               (1024×1024, no rounded corners)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_OUT = join(ROOT, "apps", "mobile", "android-icons");
const IOS_OUT = join(ROOT, "apps", "mobile", "ios-icons");

/** الخلفية التكيفية: منتصف التدرج بين #0b2a5b و #1677ff */
const ADAPTIVE_BG = "#1050AB";

const sourceSvg = readFileSync(join(ROOT, "apps", "desktop", "src-tauri", "icon.svg"), "utf8");

/** نفس رموز F1 مقياسة إلى لوحة 108×108 (المساحة الآمنة للأيقونة التكيفية). */
const FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">
  <rect x="28.69" y="30.59" width="9.7" height="46.41" rx="1.7" fill="#fff"/>
  <rect x="28.69" y="30.59" width="27" height="9.7" rx="1.7" fill="#fff"/>
  <rect x="28.69" y="48.52" width="21.94" height="8.86" rx="1.7" fill="#fff"/>
  <path d="M62.44 42.19 L70.88 30.59 L79.31 30.59 L79.31 76.99 L69.61 76.99 L69.61 42.19 Z" fill="#fff"/>
</svg>`;

/** أيقونة iOS: مربع كامل بلا هوامش ولا زوايا شفافة (iOS يقصّ الحواف بنفسه). */
const IOS_SVG = sourceSvg
  .replace('x="24" y="24" width="464" height="464" rx="104"', 'x="0" y="0" width="512" height="512" rx="0"')
  .replace('rx="104"', 'rx="0"');

function sizedSvg(svg, size) {
  return svg
    .replace('width="512" height="512"', `width="${size}" height="${size}"`)
    .replace('width="108" height="108"', `width="${size}" height="${size}"`);
}

function body(inner) {
  return `<body style="margin:0;background:transparent">${inner}</body>`;
}

async function render(page, html, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({
    path: file,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  console.log("wrote", file.replace(/\\/g, "/"));
}

async function main() {
  mkdirSync(ANDROID_OUT, { recursive: true });
  mkdirSync(IOS_OUT, { recursive: true });

  writeFileSync(
    join(ANDROID_OUT, "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\r\n<resources>\r\n    <color name="ic_launcher_background">${ADAPTIVE_BG}</color>\r\n</resources>\r\n`,
    "utf8",
  );

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage();

  const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, factor] of Object.entries(DENSITIES)) {
    const dir = join(ANDROID_OUT, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const launcher = Math.round(48 * factor);
    const foreground = Math.round(108 * factor);

    await render(
      page,
      body(sizedSvg(sourceSvg, launcher)),
      launcher,
      join(dir, "ic_launcher.png"),
    );
    await render(
      page,
      body(
        `<div style="width:${launcher}px;height:${launcher}px;border-radius:50%;overflow:hidden">${sizedSvg(sourceSvg, launcher)}</div>`,
      ),
      launcher,
      join(dir, "ic_launcher_round.png"),
    );
    await render(
      page,
      body(sizedSvg(FOREGROUND_SVG, foreground)),
      foreground,
      join(dir, "ic_launcher_foreground.png"),
    );
  }

  await render(page, body(sizedSvg(IOS_SVG, 1024)), 1024, join(IOS_OUT, "AppIcon-512@2x.png"));

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

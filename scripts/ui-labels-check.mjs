#!/usr/bin/env node
/**
 * Visible-label check: header Manager button, sidebar/mobile nav labels and the
 * heading of every view. Prints JSON. Read-only.
 *
 *   node scripts/ui-labels-check.mjs [url]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:8080/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = {};

/** Read the real manager password from the server-side .env (never the client). */
function readManagerPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*ADMIN_PASSWORD\s*=\s*(.+?)\s*$/.exec(line);
      if (m) return m[1];
    }
  }
  return "";
}

/** Header logo + width safety snapshot for the current page. */
async function headerSnapshot(p) {
  return p.evaluate(() => {
    const imgs = [...document.querySelectorAll("header img")];
    const shown = imgs.filter((i) => i.getBoundingClientRect().width > 0);
    const box = shown[0]?.getBoundingClientRect();
    const de = document.documentElement;
    return {
      logoSrc: shown[0]?.getAttribute("src") ?? null,
      logosVisible: shown.length,
      logoBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      natural: shown[0] ? { w: shown[0].naturalWidth, h: shown[0].naturalHeight } : null,
      pageOverflowX: de.scrollWidth - de.clientWidth,
      headerOverflowX: (() => {
        const h = document.querySelector("header");
        return h.scrollWidth - h.clientWidth;
      })(),
    };
  });
}

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("header", { timeout: 15000 });
  await page.waitForTimeout(1500);

  out.managerButton = (
    await page.locator("header button", { hasText: /Manager|Admin/ }).first().innerText()
  ).trim();

  out.sidebarNav = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    return aside ? [...aside.querySelectorAll("button")].map((b) => b.textContent.trim()) : null;
  });

  out.mobileNav = await page.evaluate(() => {
    const nav = [...document.querySelectorAll("nav")].find((n) => n.className.includes("fixed"));
    return nav ? [...nav.querySelectorAll("button")].map((b) => b.textContent.trim()) : null;
  });

  out.headings = {};
  for (const view of ["Overview", "TV-AC", "MDA-SDA", "Mobile", "Daily Editor", "Reports"]) {
    const btn = page.locator("aside nav button", { hasText: view }).first();
    if (!(await btn.count())) {
      out.headings[view] = "NAV-MISSING";
      continue;
    }
    await btn.click();
    await page.waitForTimeout(500);
    const h1 = page.locator("main h1").first();
    out.headings[view] = (await h1.count())
      ? (await h1.innerText()).trim().replace(/\s+/g, " ")
      : (await page.locator("main h2").first().innerText()).trim().replace(/\s+/g, " ");
  }
  // ── Header logo per theme, at desktop + phone widths ──────────────────────
  out.logo = {};
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext();
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("f1-theme", t);
      } catch {
        /* private mode */
      }
    }, theme);
    out.logo[theme] = [];
    for (const width of [1440, 390, 375]) {
      const p = await ctx.newPage();
      await p.setViewportSize({ width, height: width < 700 ? 844 : 900 });
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await p.waitForSelector("header", { timeout: 15000 });
      await p.waitForTimeout(900);
      out.logo[theme].push({ width, ...(await headerSnapshot(p)) });
      await p.close();
    }
    await ctx.close();
  }

  // ── Manager Mode at 375px: "Exit Manager" is the widest header state ──────
  const pw = readManagerPassword();
  if (pw) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 375, height: 844 });
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForSelector("header", { timeout: 15000 });
    await p.waitForTimeout(900);
    await p.getByRole("button", { name: "Manager", exact: true }).click();
    await p.waitForTimeout(400);
    await p.locator("label", { hasText: "Password" }).locator("input").first().fill(pw);
    await p.getByRole("button", { name: "Enter", exact: true }).click();
    await p.waitForTimeout(2200);
    out.managerMode375 = {
      exitLabel: (
        await p.locator("header button", { hasText: /^Exit Manager$/ }).first().innerText()
      ).trim(),
      ...(await headerSnapshot(p)),
    };
    await ctx.close();
  }
} catch (err) {
  out.error = String(err?.message || err).slice(0, 200);
} finally {
  await browser.close();
}

console.log(JSON.stringify(out, null, 1));

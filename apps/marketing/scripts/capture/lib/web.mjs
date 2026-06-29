// Web (desktop) capture driver.
//
// Drives the live Vite dev server with Playwright/Chromium to produce both
// static screenshots and short app-flow video clips for the ad. The web app
// hydrates full state from a `?s=` query param, so seeded screens (the generated
// schedule) are deterministic; the data-driven screens (explore, trends, course
// detail) just navigate directly.

import path from "node:path";

import { loadPlaywright, ensureDir, sleep } from "./util.mjs";
import { WEB_BASE_URL, WEB_VIEWPORT } from "../config.mjs";

/** Open a browser + page at the configured desktop viewport. */
export async function openWeb({ recordDir } = {}) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const context = await browser.newContext({
    viewport: { width: WEB_VIEWPORT.width, height: WEB_VIEWPORT.height },
    deviceScaleFactor: WEB_VIEWPORT.deviceScaleFactor,
    recordVideo: recordDir
      ? { dir: recordDir, size: { width: WEB_VIEWPORT.width, height: WEB_VIEWPORT.height } }
      : undefined,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WEB_BASE_URL });
  const page = await context.newPage();
  return { browser, context, page };
}

/** Build a full URL for a route, appending a `?s=` seed when provided. */
export function webUrl(route, sParam) {
  const base = `${WEB_BASE_URL}${route}`;
  if (!sParam) return base;
  const sep = route.includes("?") ? "&" : "?";
  return `${base}${sep}s=${encodeURIComponent(sParam)}`;
}

/** Navigate + let the SPA settle (data load, layout, fonts). */
export async function gotoSettled(page, url, { settleMs = 5000 } = {}) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await sleep(settleMs);
}

/** Full-viewport screenshot to an absolute path. */
export async function screenshot(page, outPath) {
  ensureDir(path.dirname(outPath));
  await page.screenshot({ path: outPath });
  return outPath;
}

// Web (desktop) screenshot orchestrator.
//
// Captures the five marketing screens from the live dev server at the desktop
// viewport. The schedule screen hydrates from the captured `?s=` seed; the rest
// are data-driven routes. Outputs land in scripts/capture/out/web/ for review
// (desktop frames aren't store-listing assets — those come from the native
// simulators — but they validate the seeds and feed the ad's desktop footage).
//
// Usage:  node scripts/capture/screenshots-web.mjs

import path from "node:path";

import { openWeb, webUrl, gotoSettled, screenshot } from "./lib/web.mjs";
import { loadWebSeeds } from "./seeds.mjs";
import { SCREENS, MARKETING_DIR } from "./config.mjs";

const OUT_DIR = path.join(MARKETING_DIR, "scripts", "capture", "out", "web");

async function captureWebScreenshots() {
  const seeds = loadWebSeeds();
  const { browser, page } = await openWeb();
  try {
    for (const screen of SCREENS) {
      const sParam = screen.seed ? seeds[screen.seed] : undefined;
      if (screen.seed && !sParam) {
        console.warn(`! no seed "${screen.seed}" for ${screen.id} — run capture-seed.mjs first`);
      }
      await gotoSettled(page, webUrl(screen.webRoute, sParam), { settleMs: 2200 });
      const out = path.join(OUT_DIR, `${screen.id}.png`);
      await screenshot(page, out);
      console.log(`✓ ${screen.id} → ${path.relative(MARKETING_DIR, out)}`);
    }
  } finally {
    await browser.close();
  }
}

await captureWebScreenshots();

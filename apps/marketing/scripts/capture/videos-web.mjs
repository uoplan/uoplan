// Web (desktop) app-flow video orchestrator.
//
// For each web AD_FLOW: open a fresh recording context, navigate (seeded when
// needed), run the scripted gesture flow, then close to flush Playwright's
// .webm. ffmpeg transcodes each clip to a clean H.264 .mp4 under public/videos/
// (gitignored, regenerable) for the ad's 3D screen textures.
//
// Usage:  node scripts/capture/videos-web.mjs

import fs from "node:fs";
import path from "node:path";

import { openWeb, webUrl, gotoSettled } from "./lib/web.mjs";
import { runFlow } from "./flows.mjs";
import { loadWebSeeds } from "./seeds.mjs";
import { run, ffmpegPath, ensureDir, sleep } from "./lib/util.mjs";
import { AD_FLOWS, VIDEOS_DIR, MARKETING_DIR } from "./config.mjs";

const TMP_DIR = path.join(MARKETING_DIR, "scripts", "capture", "out", "web-video-raw");

async function recordWebFlow(flow, seeds) {
  ensureDir(TMP_DIR);
  const rawDir = path.join(TMP_DIR, flow.id);
  fs.rmSync(rawDir, { recursive: true, force: true });
  ensureDir(rawDir);

  const { browser, context, page } = await openWeb({ recordDir: rawDir });
  const sParam = flow.seed ? seeds[flow.seed] : undefined;
  await gotoSettled(page, webUrl(flow.route, sParam), { settleMs: 5000 });
  await runFlow(flow.id, page);
  await sleep(400);
  await page.close();
  await context.close(); // flushes the .webm
  await browser.close();

  const webm = fs.readdirSync(rawDir).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error(`no recording produced for ${flow.id}`);
  return path.join(rawDir, webm);
}

async function transcode(webmPath, outPath) {
  ensureDir(path.dirname(outPath));
  // Trim the static settle prefix (data-load wait, no skeleton) so the mapped
  // clip opens on the loaded page mid-motion. Even dimensions + yuv420p for broad
  // decoder support (three.js VideoTexture).
  await run(ffmpegPath(), [
    "-y",
    "-ss",
    "4.5",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-an",
    "-movflags",
    "+faststart",
    outPath,
  ]);
}

async function main() {
  const only = process.argv.slice(2);
  const seeds = loadWebSeeds();
  const webFlows = AD_FLOWS.filter(
    (f) => f.platform === "web" && (only.length === 0 || only.includes(f.id)),
  );
  for (const flow of webFlows) {
    const webm = await recordWebFlow(flow, seeds);
    const out = path.join(VIDEOS_DIR, `${flow.id}-web.mp4`);
    await transcode(webm, out);
    console.log(`✓ ${flow.id} → ${path.relative(MARKETING_DIR, out)}`);
  }
}

await main();

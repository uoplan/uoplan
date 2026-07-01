// iOS app-flow video orchestrator (simctl recordVideo + idb gestures).
//
// Records short, camera-friendly clips of real flows on a seeded iPhone for the
// 3D ad's screen textures. Deep-links to each beat, runs a slow scripted gesture,
// and writes an H.264 mp4 into public/videos/ (gitignored, regenerable).
//
// Usage:  node scripts/capture/videos-ios.mjs [flowId...]

import path from "node:path";

import * as ios from "./lib/ios.mjs";
import * as idb from "./lib/idb.mjs";
import { sleep } from "./lib/util.mjs";
import { NATIVE_SEED_FILES } from "./seeds.mjs";
import { VIDEOS_DIR, MARKETING_DIR, IOS_BUCKETS } from "./config.mjs";

// Logical-point swipe lane for a 6.9" iPhone (402×874): scroll up the centre.
const FLOWS = [
  { id: "schedule", path: "/schedule", settle: 13000, gesture: holdStill },
  { id: "explore", path: "/explore", settle: 3500, gesture: scrollDown },
  { id: "trends", path: "/trends", settle: 3500, gesture: scrollDown },
  { id: "course", path: "/explore/course/MAT%201322", settle: 3500, gesture: scrollDown },
];

async function scrollDown(udid) {
  for (let i = 0; i < 4; i += 1) {
    await idb.swipe(udid, 200, 700, 200, 300, 700);
    await sleep(900);
  }
}

// Keep one generated schedule on screen for ~6s with gentle vertical nudges (never
// crossing weeks) so the recorder emits a multi-second clip instead of one dedup'd
// static frame, and it never jumps mid-360 spin in the ad.
async function holdStill(udid) {
  for (let i = 0; i < 5; i += 1) {
    await idb.swipe(udid, 200, 540, 200, 510, 700);
    await sleep(500);
    await idb.swipe(udid, 200, 510, 200, 540, 700);
    await sleep(500);
  }
}

async function record(flow, udid, tag) {
  await ios.openUrl(udid, `uoplan:/${flow.path}`);
  await idb.confirmOpen(udid);
  await sleep(flow.settle);
  // Dismiss the RN dev LogBox toast (Debug builds only) via its ✕ so it never covers
  // the app. Default coords suit the 402×874 iPhone; override IOS_DISMISS_X/Y per device
  // (e.g. iPad). Opt-in via IOS_TOAST_DISMISS=1 — Release builds show no toast and this
  // bottom-right tap would instead hit the basket/cart FAB.
  if (process.env.IOS_TOAST_DISMISS === "1") {
    const dx = Number(process.env.IOS_DISMISS_X ?? 372);
    const dy = Number(process.env.IOS_DISMISS_Y ?? 820);
    await idb.tap(udid, dx, dy).catch(() => {});
  }
  await sleep(1200);
  const out = path.join(VIDEOS_DIR, `${flow.id}-${tag}.mp4`);
  const stop = await ios.recordVideo(udid, out);
  await flow.gesture(udid);
  await sleep(500);
  await stop();
  console.log(`✓ ${flow.id} → ${path.relative(MARKETING_DIR, out)}`);
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dev = await ios.resolveUdid(process.env.IOS_DEVICE ?? IOS_BUCKETS[0].deviceName);
  const tag = process.env.IOS_TAG ?? "ios";
  await ios.ensureBooted(dev.udid);
  await ios.terminate(dev.udid);
  await ios.seedDocuments(dev.udid, NATIVE_SEED_FILES);
  await ios.launch(dev.udid);
  await sleep(Number(process.env.IOS_SETTLE_MS ?? 9000));
  for (const flow of FLOWS) {
    if (only.length === 0 || only.includes(flow.id)) await record(flow, dev.udid, tag);
  }
}

await main();

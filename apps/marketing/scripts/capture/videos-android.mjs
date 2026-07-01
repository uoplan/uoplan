// Android app-flow video orchestrator (adb screenrecord + input gestures).
//
// Boots the phone AVD, seeds state, deep-links to each beat and records a short
// scripted flow → public/videos/<flow>-android.mp4 for the ad's Pixel screen.
//
// Usage:  node scripts/capture/videos-android.mjs [flowId...]

import path from "node:path";

import * as android from "./lib/android.mjs";
import { sleep } from "./lib/util.mjs";
import { NATIVE_SEED_FILES } from "./seeds.mjs";
import { VIDEOS_DIR, MARKETING_DIR } from "./config.mjs";

const APK =
  process.env.ANDROID_APK ??
  path.join(
    MARKETING_DIR,
    "..",
    "native",
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "release",
    "app-release.apk",
  );
const AVD = "uoplan_test";

const FLOWS = [
  { id: "schedule", path: "/schedule", settle: 12000 },
  { id: "explore", path: "/explore", settle: 6000 },
  { id: "customize", path: "/personalize", settle: 8000 },
];

async function scroll(size) {
  for (let i = 0; i < 4; i += 1) {
    await android.swipe(size.w / 2, size.h * 0.78, size.w / 2, size.h * 0.34, 600);
    await sleep(1000);
  }
}

async function record(flow, size) {
  await android.openUrl(`uoplan:/${flow.path}`);
  await sleep(flow.settle);
  await android.tap(size.w - 70, size.h - 150); // dismiss warn toast if present
  await sleep(800);
  const out = path.join(VIDEOS_DIR, `${flow.id}-android.mp4`);
  const stop = await android.recordVideo(out);
  await scroll(size);
  await sleep(500);
  await stop();
  console.log(`✓ ${flow.id} → ${path.relative(MARKETING_DIR, out)}`);
}

async function main() {
  const only = process.argv.slice(2);
  await android.ensureBooted(AVD);
  await android.ensureInstalled(APK);
  await android.terminate();
  await android.seedDocuments(NATIVE_SEED_FILES);
  await android.launch();
  // The app holds the splash until it finishes decoding the full protobuf dataset;
  // on a RAM-starved AVD (1.5 GB) that GC-thrashes for ~90 s cold, so wait well past
  // splash before deep-linking (override with ANDROID_SETTLE_MS).
  await sleep(Number(process.env.ANDROID_SETTLE_MS ?? 100000));
  const size = await android.screenSize();
  for (const flow of FLOWS) {
    if (only.length === 0 || only.includes(flow.id)) await record(flow, size);
  }
}

await main();

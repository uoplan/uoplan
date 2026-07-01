// Android store-screenshot orchestrator.
//
// Boots each AVD bucket, installs the release APK (debuggable-signed → no LogBox),
// seeds the document-dir JSON, then for each of the five screens: deep-link →
// settle → capture at the emulator's native (store) resolution into the listing
// folder. One emulator at a time (buckets re-use one running device).
//
// Usage:  node scripts/capture/screenshots-android.mjs [bucketId] [path/to.apk]

import path from "node:path";

import * as android from "./lib/android.mjs";
import { sleep } from "./lib/util.mjs";
import { NATIVE_SEED_FILES } from "./seeds.mjs";
import { SCREENS, ANDROID_BUCKETS, STORE_LISTINGS_DIR, MARKETING_DIR } from "./config.mjs";

const SETTLE = { schedule: 60000, default: 11000 };

/** Capture screens directly. The debuggable-signed release APK shows one RN
 * "Open debugger to view warnings" toast on cold boot; we tap its X once after
 * launch. We must NOT tap per-screen — the old corner-tap landed on the
 * grade-trends tab, hijacking every screen. */
const APK =
  process.argv[3] ??
  process.env.UOPLAN_APK ??
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

async function captureBucket(bucket) {
  await android.ensureBooted(bucket.avd);
  await android.ensureInstalled(APK);
  await android.terminate();
  await android.seedDocuments(NATIVE_SEED_FILES);
  await android.launch();
  await sleep(40000);
  const size = await android.screenSize();

  const outDir = path.join(STORE_LISTINGS_DIR, bucket.dir);
  for (const screen of SCREENS) {
    await android.openUrl(`uoplan:/${screen.nativePath}`);
    await sleep(SETTLE[screen.seed] ?? SETTLE.default);
    // The debuggable-signed release APK re-shows a one-time "Open debugger to
    // view warnings" LogBox toast on each navigation. Swipe it off-screen to
    // dismiss (a corner tap risked landing on the bottom-nav trends tab and
    // hijacking the screen).
    await android.swipe(size.w * 0.6, size.h - 170, size.w * 0.04, size.h - 170, 350);
    await sleep(1200);
    // A late re-render (e.g. schedule generation finishing) can re-show the
    // toast after the first swipe, so clear it once more just before capture.
    await android.swipe(size.w * 0.6, size.h - 170, size.w * 0.04, size.h - 170, 350);
    await sleep(600);
    const out = path.join(outDir, `${screen.id}.png`);
    await android.screenshot(out);
    console.log(`✓ [${bucket.id}] ${screen.id} → ${path.relative(MARKETING_DIR, out)}`);
  }
}

async function main() {
  const only = process.argv[2];
  const buckets = only ? ANDROID_BUCKETS.filter((b) => b.id === only) : ANDROID_BUCKETS;
  for (const bucket of buckets) {
    await captureBucket(bucket);
  }
}

await main();

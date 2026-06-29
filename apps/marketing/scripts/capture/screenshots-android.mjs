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

const SETTLE = { schedule: 42000, default: 6000 };

/** Tap the RN warnings notification ("Open debugger…") X to dismiss it, if present. */
async function dismissWarnToast(size) {
  await android.tap(size.w - 70, size.h - 150);
  await android.tap(size.w - 70, size.h - 150);
}
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
    await dismissWarnToast(size);
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

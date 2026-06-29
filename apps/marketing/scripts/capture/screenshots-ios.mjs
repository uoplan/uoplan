// iOS store-screenshot orchestrator.
//
// Seeds the app (document-dir JSON), then for each of the five screens:
// deep-link → confirm the system "Open in …" prompt → settle → dismiss any
// dev-build log toast → capture at native (store) resolution into the listing
// folder. Runs every iOS bucket (iPhone 6.9", iPad 13"); the iPad app is cloned
// from the iPhone install if missing.
//
// Usage:  node scripts/capture/screenshots-ios.mjs [bucketId]

import path from "node:path";

import * as ios from "./lib/ios.mjs";
import * as idb from "./lib/idb.mjs";
import { sleep } from "./lib/util.mjs";
import { NATIVE_SEED_FILES } from "./seeds.mjs";
import { SCREENS, IOS_BUCKETS, STORE_LISTINGS_DIR, MARKETING_DIR } from "./config.mjs";

const SETTLE = { schedule: 7000, default: 3500 };

/** Dismiss the Expo dev-client LogBox / error toast if one is showing. */
async function dismissDevToast(udid) {
  const tree = await idb.describeAll(udid).catch(() => []);
  const close = tree.find(
    (el) => el.AXLabel && /close|dismiss/i.test(el.AXLabel) && el.frame?.y > 700,
  );
  if (close) {
    const { x, width, y, height } = close.frame;
    await idb.tap(udid, x + width / 2, y + height / 2).catch(() => {});
    await sleep(400);
  }
}

async function captureBucket(bucket, iphoneAppPath) {
  const dev = await ios.resolveUdid(bucket.deviceName);
  await ios.ensureBooted(dev.udid);
  await ios.ensureInstalled(dev.udid, iphoneAppPath);
  await ios.terminate(dev.udid);
  await ios.seedDocuments(dev.udid, NATIVE_SEED_FILES);
  await ios.launch(dev.udid);
  await sleep(9000);

  const outDir = path.join(STORE_LISTINGS_DIR, bucket.dir);
  for (const screen of SCREENS) {
    await ios.openUrl(dev.udid, `uoplan:/${screen.nativePath}`);
    await idb.confirmOpen(dev.udid);
    await sleep(SETTLE[screen.seed] ?? SETTLE.default);
    await dismissDevToast(dev.udid);
    const out = path.join(outDir, `${screen.id}.png`);
    await ios.screenshot(dev.udid, out);
    console.log(`✓ [${bucket.id}] ${screen.id} → ${path.relative(MARKETING_DIR, out)}`);
  }
}

async function main() {
  const only = process.argv[2];
  const buckets = only ? IOS_BUCKETS.filter((b) => b.id === only) : IOS_BUCKETS;

  // Resolve an installed .app bundle on the primary iPhone for cloning to iPad.
  const iphone = await ios.resolveUdid(IOS_BUCKETS[0].deviceName);
  await ios.ensureBooted(iphone.udid);
  const appPath = await ios.findAppBundle(iphone.udid);

  for (const bucket of buckets) {
    await captureBucket(bucket, appPath);
  }
}

await main();

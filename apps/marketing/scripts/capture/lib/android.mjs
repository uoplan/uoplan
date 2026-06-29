// Android emulator capture driver (adb / emulator).
//
// Mirrors lib/ios.mjs: boots an AVD, installs the release APK, seeds apps/native's
// JSON persistence files into the app's private files dir (via run-as on the
// debuggable release build), deep-links to each screen and captures at the
// emulator's native (store) resolution. No source changes, no UI tapping for the
// static screens.

import { capture, run, sleep } from "./util.mjs";
import fs from "node:fs";
import { APP_ID } from "../config.mjs";

const SDK = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`;
const ADB = `${SDK}/platform-tools/adb`;
const EMULATOR = `${SDK}/emulator/emulator`;

const adb = (args, opts) => run(ADB, args, opts);
const adbOut = (args) => capture(ADB, args);

/** Currently-attached, fully-booted device serials. */
async function bootedSerials() {
  const out = await adbOut(["devices"]).catch(() => "");
  return out
    .split("\n")
    .slice(1)
    .filter((l) => l.includes("\tdevice"))
    .map((l) => l.split("\t")[0]);
}

/** Boot the named AVD if no emulator is up, and wait until it's ready. */
export async function ensureBooted(avd) {
  if ((await bootedSerials()).length === 0) {
    const { spawn } = await import("node:child_process");
    spawn(EMULATOR, ["-avd", avd, "-no-snapshot-save", "-no-boot-anim"], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
  await run(ADB, ["wait-for-device"]);
  for (let i = 0; i < 90; i++) {
    const ready = await adbOut(["shell", "getprop", "sys.boot_completed"]).catch(() => "");
    if (ready.trim() === "1") break;
    await sleep(2000);
  }
  await adb(["shell", "input", "keyevent", "82"]).catch(() => {}); // dismiss lock
  await adb(["shell", "cmd", "uimode", "night", "no"]).catch(() => {}); // light mode
}

export async function ensureInstalled(apkPath) {
  const pkgs = await adbOut(["shell", "pm", "list", "packages", APP_ID]).catch(() => "");
  if (pkgs.includes(APP_ID)) return;
  if (!apkPath) throw new Error(`${APP_ID} not installed and no APK to install`);
  await adb(["install", "-r", apkPath]);
}

/** Write apps/native's persistence seeds into the app's private files dir. */
export async function seedDocuments(seedFiles) {
  for (const [name, value] of Object.entries(seedFiles)) {
    const json = JSON.stringify(value);
    const b64 = Buffer.from(json).toString("base64");
    // Stage to /data/local/tmp, then copy into the app sandbox via run-as.
    await adb(["shell", `echo ${b64} | base64 -d > /data/local/tmp/${name}`]);
    await adb(["shell", `run-as ${APP_ID} cp /data/local/tmp/${name} files/${name}`]).catch(
      () => {},
    );
  }
}

export async function terminate() {
  await adb(["shell", "am", "force-stop", APP_ID]).catch(() => {});
}

export async function launch() {
  await adb(["shell", "monkey", "-p", APP_ID, "-c", "android.intent.category.LAUNCHER", "1"]).catch(
    () => {},
  );
}

export async function openUrl(deeplink) {
  await adb([
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    deeplink,
    APP_ID,
  ]).catch(() => {});
}

export async function tap(x, y) {
  await adb(["shell", "input", "tap", String(x), String(y)]).catch(() => {});
}

/** Physical screen size in px, e.g. { w: 1080, h: 2400 }. */
export async function screenSize() {
  const out = await capture(ADB, ["shell", "wm", "size"]).catch(() => "");
  const m = out.match(/(\d+)x(\d+)/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1080, h: 2400 };
}

export async function screenshot(out) {
  // exec-out streams a raw PNG on stdout; pipe it straight to the file.
  const fd = fs.openSync(out, "w");
  try {
    await run(ADB, ["exec-out", "screencap", "-p"], { stdio: ["ignore", fd, "inherit"] });
  } finally {
    fs.closeSync(fd);
  }
}

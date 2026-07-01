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

/** Name of the AVD backing the currently-attached emulator, or "" if none. */
async function runningAvd() {
  return (await adbOut(["emu", "avd", "name"]).catch(() => "")).split("\n")[0].trim();
}

/** Boot the named AVD, replacing any other emulator already running, and wait
 * until it's ready. Each bucket targets a distinct device, so a stale emulator
 * left over from a previous bucket must be shut down or every bucket captures
 * at the first device's resolution. */
export async function ensureBooted(avd) {
  const current = await runningAvd();
  if (current && current !== avd) {
    await adb(["emu", "kill"]).catch(() => {});
    for (let i = 0; i < 30 && (await bootedSerials()).length > 0; i++) await sleep(1000);
  }
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
  // On a fresh install the app's files/ dir doesn't exist until first launch, so
  // create it (run-as works on debuggable builds) before copying the seeds in.
  await adb(["shell", `run-as ${APP_ID} mkdir -p files`]).catch(() => {});
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

export async function swipe(x1, y1, x2, y2, ms = 600) {
  await adb([
    "shell",
    "input",
    "swipe",
    String(Math.round(x1)),
    String(Math.round(y1)),
    String(Math.round(x2)),
    String(Math.round(y2)),
    String(ms),
  ]).catch(() => {});
}

/** Record screen until stop() is called; pulls the mp4 to outPath. */
export async function recordVideo(outPath) {
  const remote = "/data/local/tmp/uoplan-rec.mp4";
  const { spawn } = await import("node:child_process");
  const child = spawn(ADB, ["shell", "screenrecord", "--bit-rate", "8000000", remote], {
    stdio: "ignore",
  });
  await sleep(600);
  return async function stop() {
    child.kill("SIGINT");
    await new Promise((resolve) => child.on("close", resolve));
    await sleep(800);
    await adb(["pull", remote, outPath]).catch(() => {});
  };
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

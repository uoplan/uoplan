// iOS simulator capture driver (simctl).
//
// Seeds the app to a populated state by writing apps/native's JSON persistence
// files into the simulator's app document container, then deep-links to each
// screen and captures at native (store) resolution. No source changes, no UI
// tapping for the static screens — the schedule tab auto-generates from the
// seeded basket and the rest are data-driven routes.

import fs from "node:fs";
import path from "node:path";

import { capture, run, sleep } from "./util.mjs";
import { APP_ID } from "../config.mjs";

const simctl = (args, opts) => run("xcrun", ["simctl", ...args], opts);
const simctlOut = (args) => capture("xcrun", ["simctl", ...args]);

/** Resolve a booted-or-shutdown device UDID by its display name. */
export async function resolveUdid(deviceName) {
  const json = await simctlOut(["list", "devices", "--json"]);
  const { devices } = JSON.parse(json);
  for (const runtimeDevices of Object.values(devices)) {
    for (const d of runtimeDevices) {
      if (d.name === deviceName && d.isAvailable !== false) return d;
    }
  }
  throw new Error(`no available simulator named "${deviceName}"`);
}

/** Boot the device if it isn't already, and wait until it's ready. */
export async function ensureBooted(udid) {
  const json = await simctlOut(["list", "devices", "--json"]);
  const { devices } = JSON.parse(json);
  const all = Object.values(devices).flat();
  const dev = all.find((d) => d.udid === udid);
  if (dev?.state !== "Booted") {
    await simctl(["boot", udid]).catch(() => {});
  }
  await simctl(["bootstatus", udid, "-b"]).catch(() => {});
}

/** Make sure the app is installed; install from another device's bundle if not. */
export async function ensureInstalled(udid, fallbackAppPath) {
  const json = await simctlOut(["listapps", udid]).catch(() => "");
  if (json.includes(APP_ID)) return;
  if (!fallbackAppPath) throw new Error(`${APP_ID} not installed on ${udid} and no fallback .app`);
  await simctl(["install", udid, fallbackAppPath]);
}

/** Locate the installed .app bundle path for the app (for cloning to another sim). */
export async function findAppBundle(udid) {
  const out = await simctlOut(["get_app_container", udid, APP_ID, "app"]).catch(() => "");
  return out.trim() || null;
}

/** Write the native persistence seed files into the app's document container. */
export async function seedDocuments(udid, seedFiles) {
  const container = (await simctlOut(["get_app_container", udid, APP_ID, "data"])).trim();
  const docs = path.join(container, "Documents");
  fs.mkdirSync(docs, { recursive: true });
  for (const [name, value] of Object.entries(seedFiles)) {
    fs.writeFileSync(path.join(docs, name), JSON.stringify(value));
  }
  return docs;
}

export async function terminate(udid) {
  await simctl(["terminate", udid, APP_ID]).catch(() => {});
}

export async function launch(udid) {
  await simctl(["launch", udid, APP_ID]).catch(() => {});
}

export async function openUrl(udid, url) {
  await simctl(["openurl", udid, url]);
}

export async function screenshot(udid, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await simctl(["io", udid, "screenshot", outPath]);
  return outPath;
}

/** Start a screen recording; returns a stop() that resolves when the mp4 is flushed. */
export async function recordVideo(udid, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const { spawn } = await import("node:child_process");
  const child = spawn(
    "xcrun",
    ["simctl", "io", udid, "recordVideo", "--codec=h264", "--force", outPath],
    { stdio: "ignore" },
  );
  await sleep(800); // let the recorder spin up
  return async function stop() {
    child.kill("SIGINT"); // SIGINT finalizes the mp4 cleanly
    await new Promise((resolve) => child.on("close", resolve));
  };
}

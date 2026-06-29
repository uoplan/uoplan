// idb-based UI driver for the iOS simulator: accessibility-tree lookups (tap by
// label, no hardcoded coords) plus raw taps/swipes/text for video gestures.
//
// idb lives at the user's pip bin; override with IDB_PATH.

import { capture, run, sleep } from "./util.mjs";

const IDB = process.env.IDB_PATH ?? "/Users/matthew/Library/Python/3.9/bin/idb";

const idb = (args, opts) => run(IDB, args, opts);
const idbOut = (args) => capture(IDB, args);

/** Full accessibility tree (array of elements with AXLabel + logical frame). */
export async function describeAll(udid) {
  const json = await idbOut(["ui", "describe-all", "--udid", udid]);
  return JSON.parse(json);
}

function center(frame) {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

/** Find the first element whose AXLabel matches (string or regex). */
export function findByLabel(tree, label) {
  const match = (l) => (typeof label === "string" ? l === label : label.test(l));
  return tree.find((el) => el.AXLabel && match(el.AXLabel)) ?? null;
}

export async function tap(udid, x, y) {
  await idb(["ui", "tap", "--udid", udid, String(Math.round(x)), String(Math.round(y))]);
}

/** Tap an element by label; returns false if not present. */
export async function tapLabel(udid, label, { timeoutMs = 4000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const el = findByLabel(await describeAll(udid), label);
    if (el) {
      const { x, y } = center(el.frame);
      await tap(udid, x, y);
      return true;
    }
    if (Date.now() > deadline) return false;
    await sleep(400);
  }
}

/** Dismiss the "Open in 'uoPlan'?" deep-link confirmation if it's showing. */
export async function confirmOpen(udid) {
  await tapLabel(udid, "Open", { timeoutMs: 2500 }).catch(() => false);
}

export async function swipe(udid, x1, y1, x2, y2, durationMs = 400) {
  await idb([
    "ui",
    "swipe",
    "--udid",
    udid,
    "--duration",
    String(durationMs / 1000),
    String(Math.round(x1)),
    String(Math.round(y1)),
    String(Math.round(x2)),
    String(Math.round(y2)),
  ]);
}

export async function inputText(udid, text) {
  await idb(["ui", "text", "--udid", udid, text]);
}

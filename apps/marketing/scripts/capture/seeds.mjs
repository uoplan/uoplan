// Seed definitions for deterministic captures.
//
// Two kinds of seed:
//   • Web `?s=` blobs — full app state (term, program, completed courses,
//     generated schedule, prefs) encoded into a URL param. These can't be
//     hand-written safely (they're protobuf+deflate+base64 keyed to the data
//     indices), so they're CAPTURED once by capture-seed.mjs driving the real
//     wizard, then committed to seeds.json and replayed deterministically.
//   • Native JSON files — apps/native persists the basket / completed courses /
//     options / onboarding flag as plain JSON files in the app document dir.
//     Writing these seeds the app to a populated state on launch.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_JSON = path.join(here, "seeds.json");

/**
 * Load the captured `?s=` blobs (keyed by seed name). Returns {} if the harness
 * hasn't captured them yet — run `node capture-seed.mjs` first.
 */
export function loadWebSeeds() {
  try {
    return JSON.parse(fs.readFileSync(SEEDS_JSON, "utf8"));
  } catch {
    return {};
  }
}

export function saveWebSeeds(seeds) {
  fs.writeFileSync(SEEDS_JSON, `${JSON.stringify(seeds, null, 2)}\n`);
}

/**
 * A realistic first/second-year basket used to seed both the captured web
 * schedule and the native app. These codes are widely offered (high section
 * counts in committed catalogue data), so they reliably fill a weekly timetable.
 */
export const SEED_BASKET = ["MAT 1322", "MAT 1341", "ENG 1100", "PHY 1321", "MAT 2384"];

/** Completed courses (drives requirement progress + prerequisites) — disjoint from the basket. */
export const SEED_COMPLETED = ["ITI 1100", "ITI 1120", "MAT 1320", "ENG 1112"];

/** Native document-dir seed files (filename → JSON contents). */
export const NATIVE_SEED_FILES = {
  "uoplan-basket.json": SEED_BASKET,
  "uoplan-completed.json": SEED_COMPLETED,
  "uoplan-onboarding.json": { completed: true },
};

// Shared configuration for the capture harness (store screenshots + ad videos).
//
// One source of truth for: device buckets, the five store screens and their
// per-platform destinations, the web routes/flows, and the output locations.
// Pure data + path helpers — no side effects, no deps.

import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

/** apps/marketing */
export const MARKETING_DIR = path.resolve(here, "..", "..");
/** repo root */
export const REPO_ROOT = path.resolve(MARKETING_DIR, "..", "..");

export const STORE_LISTINGS_DIR = path.join(MARKETING_DIR, "store-listings");
export const VIDEOS_DIR = path.join(MARKETING_DIR, "public", "videos");

/** Live Vite dev server (kept running by the user, hot-reload). */
export const WEB_BASE_URL = process.env.UOPLAN_WEB_URL ?? "http://localhost:5173";

/** Native app bundle / package identifier (iOS + Android share it). */
export const APP_ID = "party.uoplan.app";

/**
 * The five store screens, in order. Each maps to a directly-navigable web route
 * and a native deep-link path (uoplan://… / https://uoplan.party/…). `seed`
 * names a seed from seeds.mjs when the screen needs populated user state.
 */
export const SCREENS = [
  {
    id: "01-weekly-schedule",
    label: "Weekly schedule",
    webRoute: "/schedule/", // hydrated from the captured ?s= seed
    nativePath: "/schedule",
    seed: "schedule",
  },
  {
    id: "02-course-explorer",
    label: "Course & professor explorer",
    webRoute: "/explore",
    nativePath: "/explore",
    seed: null,
  },
  {
    id: "03-grade-trends",
    label: "Grade trends",
    webRoute: "/trends",
    nativePath: "/trends",
    seed: null,
  },
  {
    id: "04-course-detail",
    label: "Course detail",
    webRoute: "/explore/course/mat1322/",
    // Native course detail resolves by exact catalogue code (`MAT 1322`), so the
    // deep-link param must carry the spaced, upper-case code (URL-encoded).
    nativePath: "/explore/course/MAT%201322",
    seed: null,
  },
  {
    id: "05-personalize-plan",
    label: "Personalize plan",
    webRoute: "/personalize",
    nativePath: "/personalize",
    seed: "personalize",
  },
];

/**
 * Device buckets. iOS uses simulator UDIDs resolved at runtime by name; Android
 * uses an AVD name. `dir` is the destination under store-listings.
 */
export const IOS_BUCKETS = [
  { id: "iphone-6.9", deviceName: "iPhone 16 Pro", dir: "ios/screenshots/iphone-6.9" },
  { id: "ipad-13", deviceName: "iPad Pro 13-inch (M4)", dir: "ios/screenshots/ipad-13" },
];

export const ANDROID_BUCKETS = [
  { id: "phone", avd: "uoplan_test", dir: "android/screenshots/phone" },
  { id: "tablet-7", avd: "uoplan_tab7", dir: "android/screenshots/tablet-7" },
  { id: "tablet-10", avd: "uoplan_tab10", dir: "android/screenshots/tablet-10" },
];

/**
 * Desktop viewport for web screenshots / ad footage. 2× device-scale gives crisp
 * Retina-grade frames for the 3D ad's video textures.
 */
export const WEB_VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

/**
 * App-flow video clips for the ad — one per feature beat, each driven on the
 * platform whose 3D model carries it in the timeline.
 */
export const AD_FLOWS = [
  { id: "explore", platform: "web", route: "/explore", durationMs: 9000 },
  { id: "trends", platform: "web", route: "/trends", durationMs: 9000 },
  { id: "schedule", platform: "web", route: "/schedule/", seed: "schedule", durationMs: 9000 },
  { id: "customize", platform: "web", route: "/schedule/", seed: "schedule", durationMs: 9000 },
];

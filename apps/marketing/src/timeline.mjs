// Single source of truth for timing — imported by the Remotion composition AND the
// audio synth so picture and sound stay locked. Times are in SECONDS.
export const FPS = 30;
export const DURATION_S = 40;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// ---- scenes --------------------------------------------------------------------
// A high-paced, all-3D, multi-device piece. It opens on the desktop web app (the
// hero), then hands the SAME product across devices: "now on Android" -> "iOS" ->
// "iPadOS", each running live captured app footage on a real 3D screen. Each scene
// is a fixed product pose with a slow monotonic dolly; cuts are quick dissolves.
// Captions sit beside the device, never on it, and never cover the top-left wordmark.
export const SCENES = [
  {
    start: 2.2,
    end: 9.4,
    device: { kind: "laptop", video: "videos/explore-web.mp4" },
    pose: { x: -2.0, y: -0.2, s: 0.82, yaw: -16, tilt: 9, roll: 0 },
    text: {
      side: "right",
      anim: "slideR",
      pre: "explore every",
      flip: ["professor", "course", "grade"],
    },
  },
  {
    start: 9.4,
    end: 16.2,
    device: { kind: "laptop", video: "videos/trends-web.mp4" },
    pose: { x: 1.55, y: -0.2, s: 0.82, yaw: 14, tilt: 9, roll: 0 },
    text: {
      side: "left",
      anim: "slideL",
      pre: "a decade of",
      flip: ["grades", "trends", "surveys"],
    },
  },
  {
    start: 16.2,
    end: 23.0,
    device: { kind: "laptop", video: "videos/schedule-web.mp4" },
    pose: { x: -1.55, y: -0.1, s: 0.84, yaw: -8, tilt: 7, roll: 0 },
    text: {
      side: "right",
      anim: "slideR",
      pre: "schedules from your",
      flip: ["program", "transcript", "credits"],
    },
  },
  {
    start: 23.0,
    end: 27.6,
    device: { kind: "pixel", video: "videos/customize-android.mp4" },
    pose: { x: 1.7, y: -0.55, s: 1.18, yaw: -16, tilt: 7, roll: -5 },
    text: { side: "left", anim: "slideL", pre: "now on", flip: ["Android"] },
  },
  {
    start: 27.6,
    end: 32.2,
    device: { kind: "iphone", video: "videos/schedule-ios.mp4" },
    pose: { x: -1.55, y: -0.05, s: 1.0, yaw: 14, tilt: -7, roll: 2 },
    text: { side: "right", anim: "slideR", pre: "and on", flip: ["iOS"] },
  },
  {
    start: 32.2,
    end: 36.8,
    device: { kind: "tablet", video: "videos/trends-ipad.mp4" },
    pose: { x: -0.7, y: 0.0, s: 0.8, yaw: 14, tilt: -7, roll: -3 },
    text: { side: "right", anim: "slideR", pre: "and on", flip: ["iPadOS"] },
  },
];

export const CUTS = [
  SCENES[0].start,
  ...SCENES.slice(1).map((s) => s.start),
  SCENES[SCENES.length - 1].end,
];
export const CUT_HALF = 0.16;
export const FLIP_AT = [2.4, 4.6];
export const OUTRO_START = 36.8;

const whoosh = SCENES.slice(1).map((s) => +s.start.toFixed(3));
const tick = SCENES.flatMap((s) => [s.start, ...FLIP_AT.map((f) => +(s.start + f).toFixed(3))]);
export const SFX = { whoosh, tick, impact: [OUTRO_START + 1.1] };
export const MUSIC = {
  bpm: 120,
  padStart: 0.0,
  kickIn: 0.75,
  kickOut: OUTRO_START,
  riser: OUTRO_START - 0.9,
  outroChord: OUTRO_START + 1.1,
  end: DURATION_S,
};

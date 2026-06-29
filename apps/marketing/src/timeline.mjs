// Single source of truth for timing — imported by the Remotion composition AND the
// audio synth so picture and sound stay locked. Times are in SECONDS.
export const FPS = 30;
export const DURATION_S = 24;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Screen texture order. screen indices: personalize 0, explore 1, schedule 2, trends 3.
export const SCREENS = ["personalize", "explore", "schedule", "trends"];

// ---- scenes --------------------------------------------------------------------
// The video is a sequence of distinct SHOTS (not one continuous move). Each scene is
// a fixed, composed product-photography pose — the phone holds a premium 3D angle and
// does NOT turn or change direction; only a slow, monotonic dolly-in gives it life.
// Shots are separated by quick cross-dissolves (see boundaries below), the way a real
// app ad cuts between hero frames. Captions ALWAYS sit beside / below the phone — never
// on the screen — and the phone may run partly off-frame, but must never cover the
// top-left "uoplan.party" wordmark. Poses are modelled on three reference shots:
//   - 3/4 RIGHT : phone right, angled (right edge back, slight clockwise roll), text left.
//   - 3/4 LEFT  : phone left (held LOW so its top clears the wordmark), text right.
//   - TIGHT     : phone right, near head-on, pushed in hard / cropped, text left.
//   - CLOSER    : phone centred & lifted (full device), text below.
//
// pose: yaw (Y turn, deg), tilt (X tilt, deg; negative = look up at it), roll (Z, deg),
//       x/y (world units on the z=0 plane; half-width ~4.52, half-height ~2.55), s (scale).
// text.side: "left" | "right" | "center". text.place (center only): "over" | "below".
// text.anim: caption entrance ("rise" | "slideL" | "slideR" | "fade").
export const SCENES = [
  {
    // 3/4 RIGHT — large close-up, bottom cropped off-frame, caption on the LEFT.
    // Yaw kept shallow (-16, not -24): at steeper angles the FAR (right/power) rail
    // shows a foreshortened sliver whose side button reads as "buttons bleeding
    // through the bezel". ~16 deg keeps a clear 3/4 product angle while the far rail
    // collapses to a thin clean edge.
    start: 0.3,
    end: 5.1,
    screen: 0,
    pose: { yaw: -16, tilt: 7, roll: -6, x: 2.0, y: -0.5, s: 1.22 },
    text: { side: "left", anim: "rise", pre: "start with your", flip: ["term", "major", "year"] },
  },
  {
    // 3/4 LEFT — mirror; phone floats LOW-left so its top stays clear of the top-left
    // wordmark, bottom cropped, caption on the RIGHT.
    start: 5.1,
    end: 9.8,
    screen: 1,
    pose: { yaw: 24, tilt: 7, roll: 8, x: -2.0, y: -0.58, s: 1.16 },
    text: {
      side: "right",
      anim: "slideR",
      pre: "explore every",
      flip: ["course", "professor", "program"],
    },
  },
  {
    // TIGHT close-up — phone RIGHT, near head-on, pushed in hard with most of the body
    // cropped off the bottom; caption beside it on the LEFT (never over the screen).
    start: 9.8,
    end: 14.6,
    screen: 2,
    pose: { yaw: -14, tilt: 4, roll: -5, x: 1.55, y: -0.85, s: 1.5 },
    text: { side: "left", anim: "slideL", pre: "build your", flip: ["schedule", "week", "future"] },
  },
  {
    // CLOSER — phone centred and lifted (full device in view), caption BELOW it (the
    // closing proof shot). Text sits under the phone, never on the screen.
    start: 14.6,
    end: 19.4,
    screen: 3,
    pose: { yaw: -8, tilt: 5, roll: -3, x: 0, y: 0.9, s: 0.95 },
    text: {
      side: "center",
      place: "below",
      anim: "rise",
      pre: "powered by",
      flip: ["real grades", "ten years", "real data"],
    },
  },
];

// Scene boundaries where we cut (quick cross-dissolve through the paper backdrop).
// Includes the opening reveal (first start) and the cut into the outro (last end).
export const CUTS = [
  SCENES[0].start,
  ...SCENES.slice(1).map((s) => s.start),
  SCENES[SCENES.length - 1].end,
];
// Half-width of each cross-dissolve, in seconds (a fast, almost-cut dissolve).
export const CUT_HALF = 0.16;

// Local times (relative to a scene's start) at which the flip word advances.
export const FLIP_AT = [1.7, 2.95];

export const OUTRO_START = 19.4;

// ---- audio cues (derived from the scenes so picture + sound never drift) -------
// All sounds are synthesized originals — no copyrighted audio. A soft airy swish
// rides each cut; a quiet muted tick (NOT a bright ding) lands on the caption reveal
// + each word flip; one warm resolve impact on the outro.
const whoosh = SCENES.slice(1).map((s) => +s.start.toFixed(3)); // a swish on each scene cut
const tick = SCENES.flatMap((s) => [s.start, ...FLIP_AT.map((f) => +(s.start + f).toFixed(3))]);

export const SFX = {
  whoosh,
  tick,
  impact: [OUTRO_START + 1.1],
};

export const MUSIC = {
  bpm: 120,
  padStart: 0.0,
  kickIn: 0.75,
  kickOut: OUTRO_START,
  riser: OUTRO_START - 0.9,
  outroChord: OUTRO_START + 1.1,
  end: DURATION_S,
};

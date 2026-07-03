---
name: marketing-video
description: Use when creating or editing a code-rendered launch / promo / demo video for an app (Remotion + real 3D devices showing the app), e.g. the apps/marketing "Launch" composition. Covers the fixed-pose shot system, continuous full-scene spins, multi-device staging (laptop/tablet/Pixel/iPhone) with clean hand-off cuts (no bleed-through), live app-video on 3D screens via useOffthreadVideoTexture, the automated capture harness (seed→drive→record on sim/emulator/web, settle pages first), GLB material fixes (see-through buttons, screen, glare, Dynamic Island), studio lighting, tracking contact shadows, original audio synthesis, Remotion + three async-load/preload gotchas, the verify-with-stills workflow, Discord <10MB downscale, and the uoplan.party branding rules.
---

# Remotion launch / app-demo videos

Build premium, "app-ad"-style launch videos entirely in code (no After Effects / DaVinci):
a real **3D phone** holds a sequence of fixed product-photography poses, each showing a
light-mode app screen beside a flip-word headline, cut together with quick cross-dissolves
over an **original synthesized** soundtrack.

This skill captures the non-obvious lessons from building `apps/marketing` (the `Launch`
composition). **Read it before making a new ad or changing the existing one** — most of
these were learned the hard way and are easy to regress.

## Where it lives & how to run

- Project: **`apps/marketing/`** — an **isolated** Remotion project, deliberately **NOT a
  pnpm workspace member** (`!apps/marketing` in `pnpm-workspace.yaml`). Remotion/react ship
  a fresh version most days, which trips the repo's 1-week `minimumReleaseAge` gate and
  would break every root `pnpm install`. It keeps its own `node_modules` + lockfile.
- Install standalone: `cd apps/marketing && pnpm install --ignore-workspace`.
- The iPhone GLB is **git-ignored** (~24 MB); download it per `public/models/README.md`.
- Run: `pnpm audio` (synth soundtrack) → `pnpm render`. `pnpm studio` to scrub.
- **`--gl=angle` is mandatory** on every `remotion still` / `remotion render` here — the
  default GL backend can't draw the three.js scene headlessly. (Baked into the npm scripts.)

## Mental model: a sequence of SHOTS, not one move

The single most important art-direction lesson: **do not fly one phone continuously around
the screen.** It reads as janky and "3D-demo-ish." Instead, compose **distinct fixed
product poses** (like an iPhone ad's hero frames) and **cut** between them with fast
cross-dissolves. **Web/laptop** shots hold a fixed pose with only a slow monotonic dolly-in
(scale creeps up) + barely-there upward drift. **Handheld devices** (Pixel/iPhone/iPad) get
one **continuous full-scene 360 spin** — they start turning the instant they appear and land
back at the pose yaw right as they leave, so there is **no pause before or after** (eased,
monotonic, exactly one revolution). The mirror trick: iPhone uses the **mirror** of the Pixel
pose on the opposite side (tilted the other way), so the two hand-helds bookend symmetrically.
Devices stay **upright** (don't lean the top away from camera); make them **bigger/closer**
than feels safe — handhelds read better large. This is what makes it feel intentional.

Reference poses that work: `3/4 right`, `3/4 left` (held low), `tight head-on close-up`,
`centered + lifted closer`. Vary which side the caption sits on and the caption's entrance
animation so each shot feels different.

## Single source of truth: `timeline.mjs`

All timing, structure, **and** audio cues live in one `.mjs` file imported by both the
composition and the audio synth, so **picture and sound can never drift**. It exports
`FPS/DURATION_S/WIDTH/HEIGHT`, a `SCENES[]` array (each scene carries a fixed
`pose {yaw,tilt,roll,x,y,s}` + `text {side,place?,anim,pre,flip[]}` + `screen` index),
`CUTS`, `CUT_HALF`, `FLIP_AT`, `OUTRO_START`, `SCREENS`, and derived `SFX`/`MUSIC` cue
objects. **Change cue times only here**; regenerate audio afterward (`pnpm audio`).

## Pose system (`scenePose` in `Launch.tsx`)

- `pose`: `yaw` (Y turn°), `tilt` (X°, negative looks up at it), `roll` (Z°), `x`/`y` (world
  units on the z=0 plane), `s` (scale). Camera is `fov 30 @ z=9.5`.
- Per shot: `y += u*0.1` (slow drift up), `s *= lerp(0.99, 1.035, u)` (slow push-in), where
  `u` is 0→1 progress across the shot. `brightness` stays 1 (cuts are an overlay, below).
- **Phones may run partly off-frame** (crop the bottom of a big close-up) — that's good, it
  reads as a real product shot. But a LEFT-side phone must keep its **top edge below the
  top-left `uoplan.party` wordmark** (`x[76,300], y[60,100]`) even after the upward drift.
  Verify left-phone clearance at both the shot's start AND end frames.
- Camera geometry cheat-sheet (fov 30 @ z=9.5): ~**211.8 px per world unit**; frame
  half-height ≈ 2.55 world, half-width ≈ 4.52 world at z=0. Model is `MODEL_FIT_HEIGHT≈4`
  tall at `s=1`, so its half-height ≈ `2·s`.

## Continuous handheld spin (no pause)

The handheld devices (`pixel`/`iphone`/`tablet`) do **one full eased revolution per scene**:
`yaw = pose.yaw + 360 * norm(t - sc.start, 0, sc.end - sc.start)`. It starts at the cut and
lands exactly back on the pose yaw at the next cut — start-to-end, **no still pause** at
either end (the user is explicit about this). Laptops do **not** spin (wide+short reads bad
mid-turn). Two gotchas this fixes: (1) the live clip mustn't auto-advance mid-spin (use a
**static** schedule week so the calendar doesn't jump weeks during the 360); (2) drop the
roll on iPhone to the **mirror** of Pixel's (e.g. Pixel `roll:-5` ↔ iPhone `roll:5`) so they
spin as mirror images.

## Captions (`SceneText` / `FlipWord`)

- Captions sit **beside or below** the phone — **never over the screen** (text on the app
  screen looks cheap and fights the UI). Lead-in line in `DM Mono Medium` uppercase (muted
  warm grey), headline in `DM Serif` (near-black), with one word that "flips" through
  alternatives (odometer roll: outgoing blurs up & out, incoming rolls up from below).
- Give each shot a **different single-direction entrance** (`rise` / `slideL` / `slideR` /
  `fade`) with no settle-back, so cuts feel fresh.
- Layout containers: `side:"left"` → left rail; `"right"` → right rail; `"center"` +
  `place:"below"` → bottom band; `place:"over"` → dead-center (used for the outro, not over
  the phone).

## Cross-dissolve cuts (`Dissolve`)

Cuts are a full-frame `PAPER`-colored overlay that ramps `0→1→0` within `CUT_HALF` seconds
of each boundary in `CUTS` (a fast, almost-cut dissolve through the paper backdrop). Hold
the paper opaque before the first reveal. The wordmark renders **above** the dissolve so
cuts don't make it blink. Keep `CUT_HALF` a touch wide (≈0.26) so the paper is fully opaque
across the device hand-off — that hides the half-frame where the old GLB unmounts and the new
device's video texture is still warming up (see the bleed-through fix below).

## Device hand-offs without bleed-through (the mac-flash fix)

Cutting from one 3D device to the next, the **previous device flashed for a fraction of a
frame** after the cut (e.g. the MacBook lid showed up over the Pixel). Cause: r3f's `Suspense`
fell back to the **old** device while the next clip/GLB loaded, and a stale draw survived to
the screenshot. The fix is "don't emit a frame until everything's ready, then remount clean":

- **Preload all assets up front, gated by `delayRender`:** `prefetch(staticFile(v))` every
  clip + `preloadDeviceGlbs()`, all under one `delayRender("device-files")` handle — the
  render waits, so no scene ever shows a half-loaded device.
- **Remount per scene:** `key={sc.start}` on the device `<group>` forces a fresh mount each
  cut (no stale device leaking through Suspense).
- **`preserveDrawingBuffer:false`** so a previous frame's pixels can't carry over.
- Lean on the **wide cut** (CUT_HALF) so the paper is opaque during the swap.

## The 3D phone — GLB gotchas (the expensive lessons)

The Sketchfab iPhone GLB needs real fixing in `PhoneModel.tsx`'s `traverse`. Inspect a new
GLB's materials first (parse the JSON chunk) — names and quirks vary.

1. **Double-sided body → see-through buttons/port.** The GLB ships **every** material
   `doubleSided=true` (several `alphaMode=BLEND`). Double-sided back-faces on the solid
   shell let the **far-side volume buttons / charging port / rails bleed "through" the
   bezel** at 3/4 angles. Fix: `harden()` every kept body material → `side=FrontSide`,
   `depthTest=true`, `depthWrite=true`, `transparent=false`, `opacity=1`. (If a model's
   normals are inverted, FrontSide can punch holes — fall back to `DoubleSide` but keep
   depthWrite/depthTest. Always verify at an angle.) **Then mind the angle:** even with
   correct depth, a steep yaw (≳20°) exposes the FAR rail as a foreshortened sliver whose
   side button sits right next to the black bezel and _reads_ as "buttons bleeding through"
   even though it's physically correct. Keep the button-side yaw shallow (~≤16°) so the far
   rail collapses to a thin clean edge. Distinguish the two: a button floating **on the
   black bezel, detached from the rail silhouette** = real depth bug (material fix); a button
   **on a thin far-rail edge** = just a too-steep angle (pose fix).
2. **The app screen** = a `MeshBasicMaterial` (unlit, `toneMapped:false`) mapped to the
   screenshot, swapped onto the `OLED` mesh. Use **real depth** (`depthTest/Write:true` +
   small `polygonOffset`), **not** `depthTest:false`/`renderOrder:999` — painting the app on
   top of everything is what makes rails appear to bleed through. Use `side:BackSide`: after
   the 180° Y model flip the screen's back-face points at the camera on front views (shows
   the app) and is culled on back views (app never bleeds onto the rear shell).
3. **Texture mirroring.** The 180° flip views the screen UVs from behind (mirrored app);
   un-mirror with `wrapS=RepeatWrapping`, `repeat.x=-1`, `offset.x=1` (and `flipY=false`,
   `SRGBColorSpace`).
4. **Fake glare → hide the cover glass.** The front `Glass` material (roughness 0 +
   transmission 1) mirrors the studio softboxes as a hard rectangle that reads as fake
   "glare" on the screen. **Hide that mesh** (`visible=false`); the unlit OLED already draws
   the app crisply. Also hide `OLED_off`.
5. **Solid-black Dynamic Island.** The front-camera / lens / bezel materials are shiny, so a
   reflective "camera ring" shows through. Replace them (`Plastic_LED`, `Camera_*`,
   `Display_Frame`) with a flat matte near-black `MeshStandardMaterial` (`#050505`,
   `roughness≈0.94`) so the island reads as one solid black pill.
6. **Spin about the centroid.** Center the model at the pivot **inside** the rotation group
   (`position={[-center.x,-center.y,-center.z]}` nested under the rotation), else it swings
   around an offset origin and the motion looks wrong. Normalize size via
   `MODEL_FIT_HEIGHT / bbox.size.y`.

## Lighting (`Studio` in `ThreePhone.tsx`)

Silver titanium needs studio lighting, not a default ambient. Use a bright neutral **key**
(upper front-right) to carve the specular, a subtle cool **rim** from back-left for edge
separation, a soft **fill** from below-front, plus a drei `<Environment>` with a few
neutral **`<Lightformer>` softboxes** on a dark field for soft metallic reflections. Keep
them **large + moderate (not blown out)** so the rails read silver without hard hotspots.

## Contact shadow MUST track the phone (`Launch.tsx`)

`ContactShadows` is a flat horizontal catch-plane. A **single fixed plane slices through the
phone** whenever the device sits low in frame. Instead, position it **per-pose, just below
the device**: `shadowY = pose.y - 2.0*pose.s - 0.12`, rendered every frame (a lifted closer
gets grounded; low close-ups let the shadow fall off-frame, which is fine for "floating"
shots). **Do not** set drei's `frames={1}` (it caches one render → wrong as the phone moves);
omit `frames` so it redraws each Remotion frame.

## Audio — synthesize it (no copyright)

`scripts/make-audio.mjs` builds an **original** stereo WAV from oscillators/noise (kick +
sidechain pad + bass + arp + riser + resolve chord) and SFX, with cue times **derived from
`timeline.mjs`**. Sound-design lessons:

- A **soft airy swish** rides each cut (noise through a gentle band, panned L→R) — keep it
  well below the harsh frequency band.
- The caption/flip accent is a **quiet, muted woody tick** (low-passed click + short ~180 Hz
  body), **NOT a bright "ding"** — a too-loud chime on every word flip was a repeated note.
- One **warm low impact** on the outro. Master with `tanh` soft-limit + normalize +
  global fade in/out.

## Remotion + three async-load gotchas

- Gate every async asset with `delayRender`/`continueRender`: **fonts** (FontFace), **screen
  textures** (TextureLoader), and the **GLB** (GLTFLoader). Always `continueRender` in the
  error path too, or a failed load hangs the render.
- **Still-render commit lag:** r3f draws once per Remotion frame, but the model `<primitive>`
  attaches via an async re-render _after_ that draw — so stills can screenshot an empty
  canvas. Fix: in `PhoneModel`, once the prepared scene is committed, force a synchronous
  `gl.render(scene, camera)` and only then resolve a dedicated `delayRender("phone-onscreen")`
  handle. The forced draw is what survives to the screenshot — so `preserveDrawingBuffer` is
  **off** here (set it `false`): in a multi-device piece, preserving the buffer carries the
  previous device's pixels into the next frame (back to the mac-flash bleed). Gate clips/GLBs
  with `delayRender` so a device only mounts once everything's loaded.
- `remotion.config.ts`: `setVideoImageFormat("jpeg")`, `setOverwriteOutput(true)`, modest
  `setConcurrency(4)`.

## Verify-with-stills workflow (do this every iteration)

Renders are slow and feedback is visual, so **inspect stills before full renders**:

1. Render a still at each shot's **mid-frame**: `pnpm exec remotion still src/index.ts Launch
out/t_<N>.png --frame=<N> --gl=angle`.
2. To check bezel bleed / shadow slicing closely, **crop with ffmpeg** (ImageMagick may not
   be installed): `ffmpeg -i out/t_N.png -vf "crop=W:H:X:Y" out/crop.png`. For a 3/4-right
   shot the **far side is the LEFT bezel** (and vice-versa) — crop that screen edge to see
   if buttons bleed through.
3. Only when stills look right, **full render**, then `ffprobe` it (expect 1920×1080, 30fps,
   ~24s, h264 + aac) and extract a couple of **encoded** frames to confirm end-to-end.
4. Copy the deliverable out, then **delete temp stills/crops**.

Identical byte sizes across renders of the same frame confirm the render is deterministic.

## Multi-device staging + live app video (the multi-device rework)

The current `Launch` is a ~40s **multi-device** piece: it opens on the desktop **web** app (laptop
hero), then hands the SAME product across devices — "now on Android" (Pixel) → "and on iOS"
(iPhone GLB) → "and on iPadOS" (iPad). Each device runs a **live captured app clip** mapped
onto its 3D screen, not a static screenshot.

- **`DeviceModel.tsx`** drives every device from a **real GLB** (`models/{iphone,ipad,pixel,macbook}.glb`),
  iPhone via `PhoneModel`, the others via a generic `GlbDevice` loader. A per-model `CFG`
  picks the **screen mesh** (iPad mat `screen`, MacBook mesh `ScreenImage`, Pixel mat
  `m_DisplayW*`), meshes to **hide** (glass/glare: iPad `glass`, Pixel `m_Glass`), upright
  `rot`, `fitH`, and a `mirrorX`/`flipY` texture transform. `timeline.mjs` `SCENES[]` each
  pick `device.{kind,video}` + a fixed pose; only the active device mounts per frame.
- **Orient by stills, one knob at a time:** GLTFLoader auto-uprights, but the screen UV
  handedness varies. If you see the device **back** (logo), add `rot:[0,π,0]`. Then fix the
  texture: mirrored text → toggle `mirrorX`; upside-down → toggle `flipY`. Render frame 750
  and eyeball before the full pass. Pixel needed `rot π` + `mirrorX:false`+`flipY:false`;
  iPad `mirrorX:true`; MacBook `flipY:true`.
- **Frame on the SCREEN, not the whole model** (`screenFitH`): a laptop framed on its full
  bbox wastes half the shot on keyboard/base, so the app is small and hard to read. Set
  `screenFitH` in the CFG to center + scale the device on its **screen mesh's** bbox instead —
  the display fills the frame and the keyboard crops off the bottom (the user explicitly wants
  the app close/legible, edge cropping is fine). MacBook uses `screenFitH:5.0` (≈80% of frame
  height after the scene's pose `s`); leave it unset on handhelds (they're all screen already).
  Pose `x`/`s` then fine-tune per scene since the pivot is now the screen center.
- **Live video on a mesh** = `useOffthreadVideoTexture({src: staticFile("videos/x.mp4")})`
  from `@remotion/three`. **Gotcha:** the screen renders WHITE unless you wire it imperatively —
  swap a `MeshBasicMaterial` onto the screen mesh, set `mat.map = tex`, and force a synchronous
  `gl.render(scene,camera)` in a `useEffect([tex])`. JSX `map={tex}` alone won't redraw in time.
- **Video paths**: clips live in `public/videos/` (gitignored, regenerable) → reference as
  `videos/<name>.mp4`, not the bare filename, or you 404.
- **De-Draco the Pixel** once (`npx @gltf-transform/cli dedup`) so no runtime decoder is needed.
- **Remove dev-build toasts** from captured footage (Debug RN shows `[expo-notifications]` /
  "Open debugger" LogBox toasts at the bottom). Two options: (a) tap the toast's ✕ during
  capture (opt-in, coords vary per device — see harness env below); (b) **crop-and-pad**: crop
  above the toasts then pad back to the original height with the app's sampled bg colour so the
  aspect/size is unchanged — `ffmpeg -vf "crop=W:CROPH:0:0,pad=W:H:0:0:0xF6F4F2,format=yuv420p"`
  (sample the paper bg from an empty region; uoplan's is `#F6F4F2`). Plain `crop` alone changes
  the aspect and mis-fits the screen UV — prefer crop+pad. **Release sim builds have no toast
  but are currently BROKEN** (`no such module 'UoplanEngineFFI'` — the Rust engine FFI isn't
  built for Release), so capture on **Debug** and strip toasts instead.

## Capture harness (regenerable footage + store screenshots)

`scripts/capture/` seeds a realistic state, drives each platform, and records. Same backbone
feeds the ad's videos and the store screenshots:

- **Web**: Playwright on the live dev server, 1440×900 → laptop clips. **Let each page settle
  ~5s before capturing** so the clip never opens on a skeleton or a grade-data load flash.
  The explore clip does **two searches** before scrolling down (reads as real browsing).
- **iOS/iPad**: `simctl io recordVideo` while `idb` swipes; deep-link `uoplan:/<path>`; run the
  **Debug** app (Release is broken — see above; Metro on :8081, seeds reliably via `simctl`).
  Use plain **iPhone 17 Pro** (402×874) for phone clips — matches the gesture calibration + the
  GLB; the larger Pro Max shifts every tap (the bottom-right toast-dismiss tap hits the cart FAB
  and opens the Basket sheet). On iPad the toast ✕ overlaps the Basket FAB → don't tap; crop+pad.
  The schedule clip is a **static week with several courses** — don't let the calendar
  auto-advance weeks while the device 360-spins, and a fuller week looks better than a sparse one.
- **Android**: `adb screenrecord` + `adb input swipe`; only a **debuggable (Debug) APK** can be
  seeded (`run-as` — Release isn't debuggable), and `seedDocuments()` must `run-as … mkdir -p
files` first because a fresh install has no `files/` dir until first launch. The emulator is
  slow: give the AVD **≥4 GB RAM** (`hw.ramSize=4096`, `vm.heapSize=512` in
  `~/.android/avd/<avd>.avd/config.ini`) or the Debug bundle GC-thrashes on the splash ~90 s+.
  The terminate+relaunch cold-reload is unreliable on a slow emulator (often captures the splash
  twice) — **prefer manually capturing the already-warm app** (deep-link, then `screenrecord`).
  Native has **no `?s=` deep-link hydration** — it only rehydrates from the persisted seed JSON
  files. Pixel skin is irrelevant for video — only the screen content textures the 3D model.
- **Harness env overrides**: `IOS_TOAST_DISMISS=1` + `IOS_DISMISS_X`/`IOS_DISMISS_Y` (default
  372,820 for 402×874), `IOS_SETTLE_MS` (default 9000); `ANDROID_APK` (path to the APK variant),
  `ANDROID_SETTLE_MS` (default 100000 — wait past the slow splash before deep-linking).
- Run: `node scripts/capture/videos-{web,ios,android}.mjs`. Verify each clip is non-trivial
  size + spot-check a frame (a ~140K mp4 = static/blank screen).

## Discord-friendly <10MB downscale

The deliverable is full-quality; make a separate small copy for chat — don't change the
pipeline. Two-pass libx264 (~1700k video + aac 128k) on the rendered mp4 lands ~9MB for a 40s
1080p clip; redo it whenever you re-render. Verify with `ffprobe` the result is `<10MB`.

## Branding & content rules (uoplan)

- **Light mode only.** Warm-paper background, **all-black headlines**, warm-grey lead-ins.
  **No blue accents** anywhere in the video chrome.
- The wordmark / CTA is **`uoplan.party`** — never the bare/stylized product name.
- App screenshots must be **light-mode** captures (personalize / explore / schedule / trends).
- The third-party assets are **CC BY 4.0 device models** (iPhone by Ranguel, iPad by
  DatSketch, MacBook by sugcx; Pixel from Google) — credit each small + low in the outro and
  record all four in `CREDITS.md`. All audio is original/synthesized.
- Avoid decorative blurred "blobs" as background accents (use a faint masked dot-grid +
  subtle grain instead).

## Quick reference

| Need                     | Where / value                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Add/retime a scene       | `src/timeline.mjs` `SCENES[]` (then `pnpm audio`)                                   |
| Stage a 2nd/3rd device   | `device.{kind,video}` per scene; `DeviceModel.tsx` CFG (real GLB per kind)          |
| Laptop app too small     | frame on the screen: set `screenFitH` in CFG (keyboard crops off)                   |
| Spin a handheld 360      | `yaw = pose.yaw + 360*norm(t-start,0,dur)`; laptops stay fixed                      |
| Mirror two hand-helds    | iPhone pose = Pixel pose mirrored on the other side, flip the roll                  |
| Wrong-facing GLB device  | screen back/logo → `rot:[0,π,0]`; text mirrored → `mirrorX`; upside-down → `flipY`  |
| Live app on a 3D screen  | `useOffthreadVideoTexture` + memo material + `gl.render` in effect                  |
| White device screen      | set `mat.map=tex` imperatively + force redraw (not JSX `map=`)                      |
| Prev device flashes      | `delayRender` prefetch+preloadGlb, per-scene `key`, drawBuffer false                |
| Calendar jumps mid-spin  | capture a STATIC week clip (no auto week-advance)                                   |
| Recapture footage        | `scripts/capture/videos-{web,ios,android}.mjs`; settle 5s; clips → `public/videos/` |
| Pose a phone             | `pose {yaw,tilt,roll,x,y,s}`; camera fov 30 @ z=9.5; ~211.8 px/unit                 |
| Stop see-through buttons | `harden()` body mats → `FrontSide` + depth (`PhoneModel.tsx`)                       |
| Kill screen glare        | hide the `Glass` mesh                                                               |
| Solid Dynamic Island     | matte near-black on `Plastic_LED`/`Camera_*`/`Display_Frame`                        |
| Shadow slicing the phone | track it: `shadowY = pose.y - 2.0*pose.s - 0.12`, no `frames` prop                  |
| Headless render fails    | add `--gl=angle`                                                                    |
| Empty canvas in stills   | force `gl.render` + `delayRender` gate (drawBuffer off, no bleed)                   |
| Render                   | `pnpm render` → `out/launch-video.mp4`; verify with `ffprobe`                       |
| Discord <10MB copy       | two-pass libx264 ~1700k + aac 128k on output (ffprobe to confirm)                   |

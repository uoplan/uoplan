# marketing — launch / promo videos

Code-rendered marketing videos for **uoplan.party**, built with
[Remotion](https://www.remotion.dev) + `@remotion/three`. The current composition
(`Launch`) is a 16:9 launch demo: a real 3D iPhone 17 Pro holds a sequence of fixed
product-photography poses, each showing a light-mode app screen beside a flip-word
headline, cut together with quick cross-dissolves over an original synthesized
soundtrack.

> **This package is intentionally NOT part of the pnpm workspace.** It pulls heavy,
> frequently-/freshly-published Remotion + three deps that would trip the monorepo's
> 1-week `minimumReleaseAge` gate on every root `pnpm install`. It manages its own
> `node_modules` + lockfile and is installed/run standalone (see below).

## One-time setup

```bash
cd apps/marketing
pnpm install --ignore-workspace          # standalone install (bypasses the repo age gate)
```

Then download the iPhone model (git-ignored, ~24 MB) — see
[`public/models/README.md`](public/models/README.md) for the Sketchfab link + exact path.

## Render

```bash
cd apps/marketing
pnpm audio        # synthesize public/master.wav (only needed if timeline cue times change)
pnpm render       # -> out/launch-video.mp4  (1920x1080, 30fps, h264 + aac, ~24s)
```

- `pnpm studio` — open Remotion Studio to scrub/preview interactively.
- `pnpm still` — render a single frame to `out/still.png` (add `--frame=N`).
- `pnpm typecheck` — `tsc --noEmit`.

> **`--gl=angle` is required** for both `render` and `still` (the project's npm scripts
> include it). The default GL backend cannot draw the WebGL/three scene headlessly here.

## How it's built

| File                     | Role                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/timeline.mjs`       | **Single source of truth** for timing, scenes/poses, cuts, and audio cues. Imported by both the composition _and_ the audio synth so picture + sound never drift. |
| `src/Launch.tsx`         | The composition: 3D scene, per-scene pose interpolation, captions/flip-words, cross-dissolve cuts, top-left wordmark, outro, and async asset loading.             |
| `src/PhoneModel.tsx`     | Loads + hardens the GLB (see "GLB gotchas" in the skill): screen material, matte Dynamic Island, single-sided body so nothing bleeds through.                     |
| `src/ThreePhone.tsx`     | `Studio` lighting (directional + `Environment`/`Lightformer`) tuned so titanium reads silver. (Also a dead procedural `Phone` fallback.)                          |
| `scripts/make-audio.mjs` | Synthesizes an **original** soundtrack (no copyrighted audio) to `public/master.wav`.                                                                             |
| `public/assets/*.png`    | Light-mode app screen captures (personalize / explore / schedule / trends).                                                                                       |
| `public/fonts/*`         | DM Serif Display (headlines), DM Mono / DM Mono Medium (labels/wordmark).                                                                                         |

A deep guide to the techniques (poses, GLB material fixes, Remotion async-load
gotchas, the verify-with-stills workflow, branding rules) lives in the repo skill
**`.claude/skills/remotion-launch-video/SKILL.md`** — read it before making a new ad.

## Conventions

- **Light mode only**, all-black headlines, no blue accents.
- The wordmark/CTA is **`uoplan.party`** — never the bare product name.
- All audio is synthesized; the only third-party asset is the CC BY 4.0 iPhone model,
  credited on-screen and in `CREDITS.md`.

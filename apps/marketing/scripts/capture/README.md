# Capture harness

Automated, deterministic, CI-portable capture of **both** marketing deliverables
from the current build:

- **Store screenshots** — the five screens for every device bucket.
- **App-flow videos** — real interactions (search, scroll, generate, cycle,
  expand) recorded as the on-screen footage the 3D ad maps onto each device.

Everything is driven from deterministic seeded states so the outputs refresh
reproducibly after each app update.

## How seeding works

The web app hydrates its **entire** state from a `?s=` URL param (term, program,
completed courses, the generated timetable, prefs — `packages/core/stateEncode.ts`).
That blob can't be hand-written safely, so `capture-seed.mjs` drives the real
schedule page once (adds a basket, generates, reads the Share link) and commits
the normalized `?s=` value to `seeds.json`. Every later run replays it — no
fragile UI driving during normal captures.

apps/native does **not** read `?s=`; it persists state as plain JSON files in the
app document dir (`uoplan-basket.json`, `uoplan-completed.json`, …). The native
legs seed by writing those files, then launch + deep-link to each screen.

## Layout

```
scripts/capture/
  config.mjs            device buckets, the 5 screens, web routes, ad flows, paths
  seeds.mjs             seed definitions + the captured ?s= loader (seeds.json)
  seeds.json            committed deterministic seeds (regenerate with capture:seed)
  capture-seed.mjs      one-time: drive the wizard → capture the ?s= schedule seed
  flows.mjs             scripted gesture flows per feature beat
  screenshots-web.mjs   the 5 screens → out/web/*.png (desktop)
  videos-web.mjs        the ad flows → public/videos/*-web.mp4 (gitignored)
  lib/
    util.mjs            playwright/ffmpeg resolution, shell, fs helpers
    web.mjs             Playwright desktop driver (seed, goto, screenshot, record)
  out/                  scratch screenshots / raw recordings (gitignored)
```

Playwright is borrowed from `apps/web/node_modules` (the marketing project stays
dependency-isolated from the workspace release-age gate — no new deps here).

## Run

The user keeps a Vite dev server on **:5173** (override with `UOPLAN_WEB_URL`).

```bash
pnpm capture:seed              # (re)capture the deterministic ?s= schedule seed
pnpm capture:screenshots:web   # 5 desktop screens → scripts/capture/out/web/
pnpm capture:videos:web        # 4 ad flow clips  → public/videos/*-web.mp4
HEADED=1 pnpm capture:seed     # watch any web step drive the browser
```

## Native (iOS / Android)

Store-listing screenshots come from the **simulators/emulator** at store
resolutions (web frames are desktop-only and feed the ad, not the listings):

- **iOS** — boot the sim, write the seed JSON into the app document container
  (`xcrun simctl get_app_container booted party.uoplan.app data`), launch +
  `simctl openurl uoplan://…`, then `simctl io … screenshot` /
  `recordVideo` (gestures via `idb`). Buckets: iPhone 6.9", iPad 13".
- **Android** — same idea with `adb`: push seed files, `am start` the deep link,
  `screencap` / `screenrecord` (gestures via `adb input`). Buckets: phone,
  tablet-7", tablet-10" (Pixel AVDs).

## CI portability (documented, not yet wired)

The harness shells out to platform tools only — no bespoke infra. A future CI
job would need: a macOS runner with Xcode simulators (iOS), a Linux runner with
the Android emulator (KVM), and the dev server (or a `vite preview` build) on
:5173. Wire it by calling the same `capture:*` scripts after each release.

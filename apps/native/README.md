# uoPlan native app

The uoPlan iOS + Android app — an [Expo](https://expo.dev) (SDK 56) / React Native
client in the `uoplan.party` monorepo. It shares the schedule engine, requirements
logic, data layer and UI primitives with the web app via the workspace packages.

> **Not Expo Go.** The app links a custom native module (`modules/uoplan-engine` — the
> Rust schedule engine, a JNI `libuoplan_engine.so` on Android and a
> `UoplanEngine.xcframework` on iOS). Expo Go only bundles the stock Expo SDK modules,
> so it **cannot** run this app. All development uses **development builds** (your own
> debug build of the app, with `expo-dev-client`), never Expo Go.

## Prerequisites

- **pnpm** (the repo package manager) and Node 24.
- **Rust** (stable) — the schedule engine compiles to a native lib per platform.
- **iOS:** macOS + Xcode (+ CocoaPods, bundled with Xcode).
- **Android:** Android Studio with the SDK + **NDK `27.1.12297006`**, and **JDK 17**
  (Temurin / Homebrew `openjdk@17` — Android Studio's bundled JBR fails the Gradle
  toolchain check).

## First-time setup

```bash
pnpm install                 # from the repo root
pnpm generate                # proto TS + bundled .pb data (needed by typecheck/tests/build)
```

The native Rust engine artifacts are git-ignored and must be built before a native
compile (rebuild them whenever `packages/engine` changes):

```bash
pnpm build:engine-native-ffi            # iOS  → modules/uoplan-engine/ios/UoplanEngine.xcframework
ANDROID_NDK_HOME=$ANDROID_HOME/ndk/27.1.12297006 \
  pnpm build:engine-native-ffi-android  # Android → per-ABI libuoplan_engine.so
```

## Run on a simulator / emulator (development build)

```bash
pnpm --filter native start     # Metro dev server (port 8081)
pnpm --filter native ios       # expo run:ios     — build + launch the dev client on the iOS simulator
pnpm --filter native android   # expo run:android — build + launch the dev client on an Android emulator
```

`expo run:*` runs `expo prebuild` (regenerating the git-ignored `ios/` + `android/`
projects from `app.config.ts`) and then a native debug build. Edit JS/TS and it
hot-reloads against Metro; you only rebuild when native config or dependencies change.

> On iOS, build for the **simulator** (plain `pnpm --filter native ios`). Targeting a
> _booted_ simulator with `expo run:ios --device <udid>` is misdetected as a physical
> device and fails code signing — build via the simulator path instead.

## Build a release locally (EAS, no cloud minutes)

Builds and signing are managed by EAS, but run entirely on your machine with
`--local` — the same recipe CI uses, with zero EAS Build cloud minutes. EAS holds the
signing credentials (iOS distribution cert + provisioning profile, Android keystore),
so you only need to be logged in (`eas login`, or set `EXPO_TOKEN`).

```bash
# convenience wrapper (forces our pnpm-patched local build plugin):
pnpm --filter native eas:build:local -- --profile production --platform ios
pnpm --filter native eas:build:local -- --profile production --platform android

# or call eas directly:
eas build --local --profile development --platform android   # dev-client APK, no store creds
eas build --local --profile preview     --platform ios       # internal/simulator build
eas build --local --profile production  --platform ios       # signed store build (.ipa)
```

Build profiles live in [`eas.json`](./eas.json): `development` (dev client, internal),
`preview` (internal apk / iOS simulator), `production` (store).

## Submit to the stores

```bash
eas submit --profile production --platform ios      --path <build.ipa>   # → TestFlight
eas submit --profile production --platform android  --path <build.aab>   # → Play internal track
```

The very first Android release must be uploaded to Play Console by hand before the Play
API is authorized — see the runbook.

## CI

- **`.github/workflows/native-build-check.yml`** — PR/push smoke: no-signing debug
  compile of both platforms (Android `assembleDebug` on Linux, iOS simulator build on
  macOS). Catches native breakage before release; needs no credentials.
- **`.github/workflows/native-deploy.yml`** — release: `eas build --local` on GitHub
  runners + `eas submit`. Auto-triggered by release-please, or on-demand via
  `workflow_dispatch`. Needs the `EXPO_TOKEN` secret.

## More

The full deployment runbook — credentials, store setup, the monorepo/native-engine
build steps, and Android R8/ProGuard notes — is in
[`docs/native-deploy.md`](../../docs/native-deploy.md).

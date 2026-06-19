# Native EAS deploy runbook

Manual GitHub Actions deployment for the Expo app in `apps/native` uses EAS Build and, for production builds, EAS Submit.

## Current repository state

- Workflow: `.github/workflows/native-deploy.yml`
- EAS config: `apps/native/eas.json`
- App IDs:
  - iOS bundle ID: `party.uoplan.native`
  - Android package: `party.uoplan.app`
- `apps/native/app.json` does **not** have `owner` or `extra.eas.projectId` yet. Create the real EAS project before running CI.
- Build numbers use `cli.appVersionSource = "remote"` with production `autoIncrement`, so EAS manages iOS build numbers and Android version codes.
- No EAS `development` build profile is checked in yet because `expo-dev-client` is not installed. Add that dependency before adding a `developmentClient: true` profile.

## One-time setup checklist

### 1. Create and link the Expo/EAS project

From the repository root:

```bash
pnpm --dir apps/native dlx eas-cli@latest login
pnpm --dir apps/native dlx eas-cli@latest init
```

Use the real Expo account or organization. Commit only the real `owner` and `extra.eas.projectId` that `eas init` writes to `apps/native/app.json`; do not invent these values.

### 2. Add the GitHub Actions secret

Create an Expo access token from expo.dev, then add it as a repository secret:

- Secret name: `EXPO_TOKEN`
- Required by: `expo/expo-github-action@v8`

The token should belong to a user or robot user that can build and submit the EAS project.

### 3. Configure build signing credentials

Run:

```bash
pnpm --dir apps/native dlx eas-cli@latest credentials
```

Use EAS-managed credentials unless there is a reason to keep local signing files. Configure both platforms for the `production` profile before using `submit=true`.

### 4. Configure iOS TestFlight submission

In Apple Developer / App Store Connect:

- Create the App Store Connect app record for bundle ID `party.uoplan.native`.
- Note the numeric App Store Connect app ID (`ascAppId`) from App Information.
- Create an App Store Connect API key (`.p8`), Key ID, and Issuer ID.

Wire the API key through EAS:

```bash
pnpm --dir apps/native dlx eas-cli@latest credentials --platform ios
```

Choose the `production` profile, then configure **App Store Connect: Manage your API Key** for EAS Submit. After the app record exists, add the real `ascAppId` to `apps/native/eas.json` under `submit.production.ios` if EAS Submit cannot infer it non-interactively.

### 5. Configure Android Play internal-track submission

In Google Play Console:

- Create the app with package `party.uoplan.app`.
- Create a Google Play service account JSON key.
- Grant it release permissions for the app.
- Upload the JSON key in the EAS dashboard under the project’s Android credentials, or via `eas credentials --platform android`.
- Upload the first Android build manually once if Google Play API access has not been initialized for the app.

The current `eas.json` uses EAS-managed submit credentials and targets the `internal` track, so no Google key is stored in GitHub Secrets.

## Running the workflow

1. Go to GitHub Actions.
2. Open **Native Deploy**.
3. Click **Run workflow**.
4. Pick:
   - `platform`: `ios`, `android`, or `all`
   - `profile`: `production` or `preview`
   - `submit`: `true` only for `production`

Preview builds are internal install builds (`apk` on Android, simulator build on iOS) and are not submitted to stores.

## First Android release (manual Play upload)

For the **very first** Play Store release you upload the `.aab` by hand — EAS Submit's Play API is not authorized until at least one build has been uploaded manually, and Play Console shows a "drop app bundles here" uploader for this. Do **not** use `--auto-submit` or `--platform all` (iOS needs separate Apple credentials) for this first build.

Prereqs: the EAS project id is already set in `app.json` (`extra.eas.projectId`). Authenticate first — either `export EXPO_TOKEN=<expo.dev access token>` or run `pnpm --dir apps/native dlx eas-cli@latest login`.

```bash
# 1. (once) reconcile owner/slug with the linked project
pnpm --dir apps/native dlx eas-cli@latest init --id 9324474b-4ac4-4f5d-871d-5eebea45fbb6

# 2. Build the signed app bundle (EAS auto-generates + stores the Android
#    upload keystore on this first run). buildType=app-bundle comes from the
#    production profile in eas.json.
pnpm --dir apps/native dlx eas-cli@latest build --platform android --profile production --non-interactive

# 3. Download the resulting .aab (the build page prints a URL; or:)
pnpm --dir apps/native dlx eas-cli@latest build:download --platform android --latest

# 4. Upload that .aab in Play Console → Production (or Internal testing) → Create release.
```

After the first manual upload succeeds and the Play Developer API is authorized for the app, later releases can use `eas build --platform android --profile production --auto-submit` (the production submit profile targets the `internal` track) or the **Native Deploy** GitHub workflow with `submit: true`.

## Monorepo and native engine notes

EAS runs the Expo build remotely, so generated artifacts must be recreated on the EAS worker. The native package's guarded `postinstall` script runs `apps/native/scripts/eas-postinstall.mjs` only when `EAS_BUILD=true`, which:

- runs `pnpm generate` at the monorepo root so `@uoplan/proto/src/generated/*` exists;
- installs Rust via rustup if needed (both platforms);
- on **iOS** builds the Rust engine XCFramework with `pnpm build:engine-native-ffi`;
- on **Android** adds the Rust Android targets, installs `cargo-ndk` if missing, and builds the per-ABI `libuoplan_engine.so` with `pnpm build:engine-native-ffi-android`.

The native app does not import the web `@uoplan/engine` WASM package during Expo builds. iOS links the native `UoplanEngine.xcframework`; Android loads the per-ABI `libuoplan_engine.so` (JNI exports in `packages/engine/src/jni_android.rs`) from the `uoplan-engine` Expo module's git-ignored `jniLibs`. Because those `.so` files are build artifacts, the EAS Android build must compile them on the worker (see the `EAS_BUILD_PLATFORM === "android"` branch above) or the app crashes with `UnsatisfiedLinkError` on schedule generation. The Android build requires an NDK on the worker (`ANDROID_NDK_HOME`, or `ANDROID_HOME/ndk/<version>`).

## Android R8 / ProGuard (code + resource shrinking)

Release Android builds enable R8 minification and resource shrinking via the
`expo-build-properties` config plugin in `apps/native/app.json`:

```jsonc
[
  "expo-build-properties",
  {
    "android": {
      "enableMinifyInReleaseBuilds": true, // R8 code shrink + obfuscation
      "enableShrinkResourcesInReleaseBuilds": true,
      "extraProguardRules": "-keep class party.uoplan.engine.** { *; } ...",
    },
  },
]
```

**Why the keep rules are mandatory.** The Rust engine is reached through JNI:
`party.uoplan.engine.UoplanEngineModule` declares `external` native methods whose
implementations are resolved _by C symbol name_ (`Java_party_uoplan_engine_UoplanEngineModule_*`
in `packages/engine/src/jni_android.rs`). If R8 renames that class or its native
methods, the symbol no longer matches and the app crashes with
`UnsatisfiedLinkError` the moment a schedule is generated. The `extraProguardRules`
therefore `-keep` the whole `party.uoplan.engine.**` package and keep the names of
any class that declares `native <methods>`. React Native, Hermes and the Expo
modules ship their own consumer ProGuard rules, so only the custom engine module
needs an explicit rule here.

> **Verify before shipping the next release.** R8 changes only take effect in a
> release build, so they cannot be exercised by the dev client. Before submitting
> the next build, run a production build and **generate a schedule on a real
> device/emulator** to confirm the engine still links (no `UnsatisfiedLinkError`)
> and that resource shrinking didn't drop anything user-visible. To deobfuscate
> future crash reports, upload the `mapping.txt` that EAS produces with the build
> (Play Console → App bundle explorer → Downloads), or let EAS auto-upload it.

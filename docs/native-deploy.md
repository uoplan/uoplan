# Native EAS deploy runbook

Manual GitHub Actions deployment for the Expo app in `apps/native` uses EAS Build and, for production builds, EAS Submit.

## Current repository state

- Workflow: `.github/workflows/native-deploy.yml`
- EAS config: `apps/native/eas.json`
- App IDs:
  - iOS bundle ID: `party.uoplan.native`
  - Android package: `party.uoplan.native`
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

- Create the app with package `party.uoplan.native`.
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

## Monorepo and native engine notes

EAS runs the Expo build remotely, so generated artifacts must be recreated on the EAS worker. The native package's guarded `postinstall` script runs `apps/native/scripts/eas-postinstall.mjs` only when `EAS_BUILD=true`, which:

- runs `pnpm generate` at the monorepo root so `@uoplan/proto/src/generated/*` exists;
- installs Rust via rustup on EAS iOS workers if needed;
- builds the iOS Rust engine XCFramework with `pnpm build:engine-native-ffi`.

The native app does not currently import the web `@uoplan/engine` WASM package during Expo builds. iOS links the native `UoplanEngine.xcframework`; Android currently has no native engine module configured.

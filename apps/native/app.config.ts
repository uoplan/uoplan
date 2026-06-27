import type { ConfigContext, ExpoConfig } from "expo/config";

// release-please owns the app version: it bumps the monorepo root package.json
// (the `.` package in release-please-config.json) on every release. That value
// is the single source of truth for the version we publish to the App Store /
// Play Store, so the static `version` in app.json is intentionally overridden
// here rather than maintained by hand.
//
// The release-please version is a prerelease (e.g. `1.0.0-beta.37`), but store
// marketing versions must be a numeric MAJOR.MINOR.PATCH (Apple rejects a
// non-numeric CFBundleShortVersionString), so we strip any prerelease/build
// suffix. The per-build identifier (iOS buildNumber / Android versionCode) is
// auto-incremented by EAS (`appVersionSource: remote` + `autoIncrement`), so
// successive betas of the same MAJOR.MINOR.PATCH still get unique store builds.
// oxlint-disable-next-line typescript/no-require-imports
const rootVersion = (require("../../package.json") as { version: string }).version;
const marketingVersion = rootVersion.split("-")[0];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "uoPlan",
  slug: config.slug ?? "uoplan",
  version: marketingVersion,
});

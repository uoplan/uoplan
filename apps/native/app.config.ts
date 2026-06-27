import type { ConfigContext, ExpoConfig } from "expo/config";
import { AndroidConfig, type ConfigPlugin, withStringsXml } from "expo/config-plugins";

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

// The user-facing app name is "uoPlan", but `expo.name` also seeds every
// generated native identifier (iOS Xcode project/scheme/folder + PRODUCT_NAME,
// Android rootProject.name). We keep `expo.name` lowercase ("uoplan") so those
// internals stay lowercase, then restore the "uoPlan" launcher/display label per
// platform:
//   - iOS: ios.infoPlist.CFBundleDisplayName/CFBundleName in app.json — Expo's
//     name plugins respect a user-provided infoPlist value over `expo.name`.
//   - Android: the `app_name` string resource has no such guard, so we override
//     it here via a strings.xml config plugin.
const DISPLAY_NAME = "uoPlan";

const withAndroidDisplayName: ConfigPlugin = (config) =>
  withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: "app_name", value: DISPLAY_NAME })],
      cfg.modResults,
    );
    return cfg;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withAndroidDisplayName({
    ...config,
    name: config.name ?? "uoplan",
    slug: config.slug ?? "uoplan",
    version: marketingVersion,
  });

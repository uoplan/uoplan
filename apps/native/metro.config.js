// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro does not honor the package `exports` subpath map for our workspace
// packages, so deep imports like `@uoplan/core/gradeDistribution` fail to
// resolve. Rewrite `@uoplan/<pkg>/<sub>` to its physical `src/<sub>` file for the
// packages we deep-import. This lets native screens pull ONLY the pure helpers
// they need (grade math, calendar layout, etc.) instead of a package barrel —
// e.g. the `@uoplan/core` barrel re-exports `ics`, which would otherwise drag the
// Node-only `ical-generator` into the native bundle, and `@uoplan/calendar`'s
// barrel pulls the `@uoplan/core` barrel transitively.
const SUBPATH_PACKAGES = ["@uoplan/core", "@uoplan/calendar", "@uoplan/data"];

// `@uoplan/proto`'s `exports` map points each subpath at `src/generated/<name>`
// (e.g. `@uoplan/proto/data` → `src/generated/data.ts`). Metro ignores that map,
// so rewrite proto subpaths to the physical generated file. The native data
// layer decodes `.pb` bytes with these generated message codecs.
const PROTO_PREFIX = "@uoplan/proto/";

// `@uoplan/i18n` exports its compiled catalogs at `./catalogs/<locale>` →
// `src/locales/<locale>/messages.ts` (NOT `src/catalogs/<locale>`), so — like
// proto — the naive `${pkg}/src/${sub}` rewrite can't reach them. Map the catalog
// subpaths to their physical compiled-catalog module instead. The native i18n
// adapter imports `@uoplan/i18n/catalogs/en` + `.../fr-CA`.
const I18N_CATALOG_PREFIX = "@uoplan/i18n/catalogs/";

// Force a single `@lingui/react` instance. Expo SDK 56 pins `react` 19.2.3 while
// the shared `@uoplan/i18n` (and web) resolve `react` 19.2.4, so pnpm keys two
// `@lingui/react` copies on their differing peer `react` — each with its own
// React Context. The native adapter's `useTr()`/`useLingui()` would then never
// see the `<I18nProvider>` rendered by `LocaleProvider`. Pin every `@lingui/react`
// (and `@lingui/core`) import to apps/native's copy so context is shared. Use the
// app-relative `require.resolve` so the rewrite tracks the installed version.
const LINGUI_SINGLETONS = ["@lingui/react", "@lingui/core"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(PROTO_PREFIX) && !moduleName.startsWith(`${PROTO_PREFIX}src/`)) {
    const sub = moduleName.slice(PROTO_PREFIX.length);
    return context.resolveRequest(context, `@uoplan/proto/src/generated/${sub}`, platform);
  }
  if (moduleName.startsWith(I18N_CATALOG_PREFIX)) {
    const locale = moduleName.slice(I18N_CATALOG_PREFIX.length);
    return context.resolveRequest(context, `@uoplan/i18n/src/locales/${locale}/messages`, platform);
  }
  for (const pkg of LINGUI_SINGLETONS) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      try {
        return context.resolveRequest(context, require.resolve(moduleName), platform);
      } catch {
        // Fall through to default resolution if the app copy can't be resolved.
        break;
      }
    }
  }
  for (const pkg of SUBPATH_PACKAGES) {
    const prefix = `${pkg}/`;
    if (moduleName.startsWith(prefix) && !moduleName.startsWith(`${pkg}/src/`)) {
      const sub = moduleName.slice(prefix.length);
      return context.resolveRequest(context, `${pkg}/src/${sub}`, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

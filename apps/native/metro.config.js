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

config.resolver.resolveRequest = (context, moduleName, platform) => {
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

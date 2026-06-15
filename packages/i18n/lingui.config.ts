import type { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

/**
 * Lingui config for the shared catalog package.
 *
 * `@uoplan/i18n` owns the canonical PO catalogs (`src/locales/{locale}/messages.po`)
 * and compiles them to bundler-agnostic TypeScript modules
 * (`src/locales/{locale}/messages.ts`) via `pnpm --filter @uoplan/i18n run generate`
 * (`lingui compile --typescript --namespace es`). Both shells consume those compiled
 * catalogs: web imports them directly (no Vite `.po` plugin), and native resolves them
 * through Metro. This app uses explicit string ids (not Lingui macros), so
 * `lingui extract` is never run — the catalogs are hand-maintained via the repo's
 * `pnpm i18n:sync` / `pnpm check:i18n` tooling.
 */
const linguiConfig: Parameters<typeof defineConfig>[0] = {
  sourceLocale: "en",
  locales: ["en", "fr-CA"],
  format: formatter({
    explicitIdAsDefault: true,
  }),
  compileNamespace: "es",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
    },
  ],
};

export default linguiConfig;

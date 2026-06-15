import { defineConfig } from "vitest/config";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { playwright } from "@vitest/browser-playwright";
import { visualizer } from "rollup-plugin-visualizer";
import { changelogHtmlPlugin } from "./vite/changelog-html-plugin";
import { dataManifestPlugin } from "./vite/data-manifest-plugin";
import { dataDevServerPlugin } from "./vite/data-dev-server-plugin";

const analyze = process.env.ANALYZE === "1";

export default defineConfig({
  plugins: [
    changelogHtmlPlugin(),
    dataManifestPlugin(),
    dataDevServerPlugin(),
    analyze &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/workers",
      filename: "sw.ts",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // Our SW does no precaching; disable the `self.__WB_MANIFEST` scan
        // so the build doesn't fail when the token is absent.
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
        type: "classic",
      },
    }),
    // Runs the Cloudflare Worker (apps/worker) in workerd inside the Vite dev
    // server and bundles it on `vite build`. Disabled under Vitest so the
    // Cloudflare environments don't interfere with the test runner, and under
    // `E2E_SERVER=preview` (the a11y job) where `vite preview` only serves the
    // static client bundle and has no `.wrangler/deploy/config.json`.
    !process.env.VITEST &&
      process.env.E2E_SERVER !== "preview" &&
      cloudflare({
        configPath: "../../wrangler.json",
        // Persist local KV/D1/etc. state at the repo root (next to the wrangler
        // config) instead of under apps/web, so it matches where
        // `wrangler d1 migrations apply --local` writes. Without this the dev
        // server reads an empty DB and D1 queries fail with "no such table".
        persistState: { path: "../../.wrangler/state" },
      }),
  ],
  define: {
    // Cloudflare Workers Builds exposes WORKERS_CI_* at build time.
    __COMMIT_HASH__: JSON.stringify((process.env.WORKERS_CI_COMMIT_SHA || "dev").slice(0, 7)),
    __BRANCH_NAME__: JSON.stringify(process.env.WORKERS_CI_BRANCH || ""),
  },
  // Keep a single React instance across pre-bundled deps so zustand's `useStore`
  // (and any other hook-calling dep) shares the renderer's dispatcher in Browser Mode.
  resolve: {
    // `@lingui/core` / `@lingui/react` are deduped so the whole graph shares ONE
    // `i18n` singleton + `I18nProvider` React context. pnpm resolves two physically
    // distinct `@lingui/core@5.9.3` copies that differ only by their `typescript`
    // peer context (apps/web → ts 5.9.3, packages/i18n / @uoplan/i18n → ts 6.0.3);
    // without deduping, `tr()` and a test/component importing `@lingui/core`
    // directly would touch different singletons (one never `activate()`d).
    dedupe: ["react", "react-dom", "@lingui/core", "@lingui/react"],
    // Cross-platform component contract (@uoplan/ui): prefer `*.web.tsx`
    // implementations on web so Vite resolves the Mantine variant, while Metro
    // resolves `*.native.tsx` for the Expo app. Keep the default extensions
    // after the `.web.*` ones as fallbacks.
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".mjs",
      ".js",
      ".mts",
      ".ts",
      ".jsx",
      ".tsx",
      ".json",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-dev-runtime",
      "zustand",
      "zustand/vanilla",
      "zustand/react/shallow",
      "@mantine/hooks",
      "@mantine/charts",
      "recharts",
      "@tabler/icons-react",
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.browser.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**",
        "src/routeTree.gen.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.pnpm-store/**", "**/*.browser.test.*"],
          setupFiles: ["./src/test/engineSetup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          globals: true,
          include: ["src/**/*.browser.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/.pnpm-store/**"],
          setupFiles: ["./src/test/browserSetup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  build: {
    sourcemap: true,
    // Never inline `.pb` data assets — they must stay as content-hashed files so
    // they're cacheable (immutable) and resolvable by the worker via the manifest.
    assetsInlineLimit: (filePath: string) => (filePath.endsWith(".pb") ? false : undefined),
  },
});

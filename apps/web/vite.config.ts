import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { playwright } from "@vitest/browser-playwright";
import { changelogHtmlPlugin } from "./vite/changelog-html-plugin";

export default defineConfig({
  plugins: [
    changelogHtmlPlugin(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    lingui(),
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
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify((process.env.CF_PAGES_COMMIT_SHA || "dev").slice(0, 7)),
    __BRANCH_NAME__: JSON.stringify(process.env.CF_PAGES_BRANCH || ""),
  },
  // Keep a single React instance across pre-bundled deps so zustand's `useStore`
  // (and any other hook-calling dep) shares the renderer's dispatcher in Browser Mode.
  resolve: {
    dedupe: ["react", "react-dom"],
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
      "@tabler/icons-react",
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.pnpm-store/**", "**/*.browser.test.*"],
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
  },
});

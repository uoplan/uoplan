import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
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
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.pnpm-store/**"],
  },
  build: {
    sourcemap: true,
  },
});

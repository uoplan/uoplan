import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

/**
 * Vite + crxjs build for the MV3 extension. crxjs reads `manifest.config.ts`,
 * bundles every referenced entry (background / content / popup), and emits a
 * loadable extension into `dist/`. Workspace `@uoplan/*` packages are TS source,
 * so Vite transpiles them in-graph — no prebuilt artifacts required (besides the
 * generated proto, produced by `pnpm --filter @uoplan/proto generate`).
 */
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Extension contexts have no inline-script CSP relief; keep modules as files.
    target: "esnext",
  },
  server: {
    // Keep the extension HMR server off the web app's port (5173).
    port: 5179,
    strictPort: false,
  },
});

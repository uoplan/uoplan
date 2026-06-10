import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

// When E2E_SERVER=preview, serve the already-built production bundle via
// `vite preview` instead of the dev server. CI uses this for the accessibility
// job so it tests the real bundle without rebuilding the WASM engine. The
// Cloudflare plugin is disabled in this mode (see vite.config.ts), so Vite's
// default `build.outDir` is `dist`; the client bundle lives in `dist/client`,
// so point preview there explicitly.
const USE_PREVIEW = process.env.E2E_SERVER === "preview";
const WEB_SERVER_COMMAND = USE_PREVIEW
  ? `pnpm exec vite preview --outDir dist/client --port ${PORT} --strictPort`
  : "pnpm dev";

/**
 * Playwright end-to-end config for the web app.
 *
 * Runs against the Vite dev server (committed `.pb` assets in `src/assets/data`
 * make the app deterministic without a network). Phase 5 adds fixture-based
 * data seams for fully hermetic flows; this scaffold covers smoke coverage.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: WEB_SERVER_COMMAND,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

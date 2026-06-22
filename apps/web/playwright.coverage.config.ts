import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the runtime-coverage crawl ONLY. Runs against a fresh
 * COVERAGE=1 instrumented dev server on a dedicated port (5274) so it never
 * touches the maintainer's port-5173 dev server, and only executes
 * `coverage-crawl.spec.ts`. Output snapshots land in `apps/web/.nyc_output/`;
 * turn them into a report with `pnpm --filter web coverage:report`.
 */
const PORT = 5274;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /coverage-crawl\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: BASE_URL,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `COVERAGE=1 VITE_COVERAGE=true pnpm exec vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

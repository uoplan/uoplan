/**
 * Lighthouse CI config — driven by `pnpm lighthouse` (scripts/lighthouse.mjs).
 *
 * Audits a production build served via `vite preview`, reusing the same
 * `E2E_SERVER=preview` static-serve path the accessibility CI job uses (the
 * Cloudflare vite plugin is disabled in that mode, so preview serves the static
 * `dist/client` bundle). Runs on a dedicated port so it never collides with the
 * dev server on :5173.
 *
 * Report-only: there is intentionally NO `assert` block, so Lighthouse score
 * regressions never fail the run (and never block the pre-push hook). Reports
 * are written to `.lighthouseci/` (gitignored) and summarised to stdout by the
 * orchestrator.
 *
 * PWA category note: Lighthouse 12 (bundled with @lhci/cli >= 0.15) removed the
 * PWA category, so only the four remaining categories are collected.
 */

const PORT = 4178;
const ORIGIN = `http://localhost:${PORT}`;

const ROUTES = [
  "/",
  "/explore/",
  "/explore/course/iti1120",
  "/personalize",
  "/explore/professor/abdorrahim-bahrami",
  "/trends/",
  "/trends/disciplines",
];

module.exports = {
  ci: {
    collect: {
      // `E2E_SERVER=preview` disables the Cloudflare plugin so `vite preview`
      // serves the static client bundle (see apps/web/vite.config.ts). The
      // client bundle lives in `dist/client`; `--strictPort` fails loudly
      // instead of silently picking another port.
      startServerCommand: `E2E_SERVER=preview pnpm exec vite preview --outDir dist/client --port ${PORT} --strictPort`,
      startServerReadyPattern: "Local:",
      startServerReadyTimeout: 60_000,
      url: ROUTES.map((route) => `${ORIGIN}${route}`),
      numberOfRuns: 1,
      settings: {
        // PWA removed in Lighthouse 12; audit the four available categories.
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%.report.%%EXTENSION%%",
    },
  },
};

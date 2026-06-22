/**
 * `pnpm lighthouse` — runs Lighthouse CI (@lhci/cli) against a production build
 * of the web app and prints a per-URL score summary. Wired into lefthook as a
 * report-only `pre-push` hook (it never fails on low scores).
 *
 * Flow:
 *   1. Build the web app (so we audit the code being pushed), unless
 *      LH_SKIP_BUILD=1. The Rust→WASM engine is only rebuilt if missing.
 *   2. Resolve a Chrome/Chromium binary (prefers the Playwright Chromium that's
 *      already a dev dependency, for consistency with CI; falls back to system
 *      Chrome via lhci's default search).
 *   3. Run `lhci autorun` (collect → upload), serving the build via
 *      `vite preview`. The lhci config is generated as a temp JSON file from
 *      LH_CONFIG below (lhci cannot load a `.ts` config).
 *   4. Read `.lighthouseci/manifest.json` and print a category score table.
 *
 * Env:
 *   LH_SKIP_BUILD=1   Skip the build step and audit the existing dist/client.
 *   CHROME_PATH=...   Force a specific Chrome/Chromium binary.
 */

import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "apps", "web");
const MANIFEST = path.join(WEB_DIR, ".lighthouseci", "manifest.json");

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

// Lighthouse CI config (previously apps/web/lighthouserc.cjs). Audits a
// production build served via `vite preview`, reusing the same
// `E2E_SERVER=preview` static-serve path the accessibility CI job uses (the
// Cloudflare vite plugin is disabled in that mode, so preview serves the static
// `dist/client` bundle). Report-only: there is intentionally NO `assert` block,
// so Lighthouse score regressions never fail the run. PWA category was removed
// in Lighthouse 12 (bundled with @lhci/cli >= 0.15), so only the four remaining
// categories are collected.
const LH_PORT = 4178;
const LH_ORIGIN = `http://localhost:${LH_PORT}`;
const LH_ROUTES = [
  "/",
  "/explore/",
  "/explore/course/iti1120",
  "/personalize",
  "/explore/professor/abdorrahim-bahrami",
  "/trends/",
  "/trends/disciplines",
];

const LH_CONFIG = {
  ci: {
    collect: {
      // `E2E_SERVER=preview` disables the Cloudflare plugin so `vite preview`
      // serves the static client bundle (see apps/web/vite.config.ts). The
      // client bundle lives in `dist/client`; `--strictPort` fails loudly
      // instead of silently picking another port.
      startServerCommand: `E2E_SERVER=preview pnpm exec vite preview --outDir dist/client --port ${LH_PORT} --strictPort`,
      startServerReadyPattern: "Local:",
      startServerReadyTimeout: 60_000,
      url: LH_ROUTES.map((route) => `${LH_ORIGIN}${route}`),
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

function run(command: string, args: string[], opts: SpawnSyncOptions = {}): number {
  const result = spawnSync(command, args, { stdio: "inherit", ...opts });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function buildWebApp(): void {
  if (process.env.LH_SKIP_BUILD === "1") {
    console.log("• LH_SKIP_BUILD=1 — auditing the existing dist/client build.");
    return;
  }

  const enginePkg = path.join(ROOT, "packages", "engine", "pkg");
  if (!fs.existsSync(enginePkg)) {
    console.log("• Building the Rust→WASM engine (packages/engine/pkg missing)…");
    if (run("pnpm", ["build:engine-wasm"], { cwd: ROOT }) !== 0) {
      die("engine WASM build failed.");
    }
  }

  console.log("• Building the web app (pnpm --filter web build)…");
  if (run("pnpm", ["--filter", "web", "build"], { cwd: ROOT }) !== 0) {
    die("web build failed. Re-run with LH_SKIP_BUILD=1 to audit an existing build.");
  }
}

function resolveChrome(): void {
  if (process.env.CHROME_PATH) {
    console.log(`• Using CHROME_PATH=${process.env.CHROME_PATH}`);
    return;
  }

  // Prefer the Playwright Chromium that's already installed for the web app —
  // it's deterministic across machines and present in CI.
  const probe = spawnSync(
    "pnpm",
    [
      "--filter",
      "web",
      "exec",
      "node",
      "-e",
      "try{process.stdout.write(require('playwright').chromium.executablePath())}catch{}",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const candidate = (probe.stdout || "").trim();
  if (candidate && fs.existsSync(candidate)) {
    process.env.CHROME_PATH = candidate;
    console.log(`• Using Playwright Chromium: ${candidate}`);
    return;
  }

  console.log("• Falling back to system Chrome (lhci default search).");
}

function audit(): void {
  console.log("• Running Lighthouse CI…\n");
  // lhci cannot load a `.ts` config, so materialise LH_CONFIG as a temp JSON
  // file. Relative paths inside it (dist/client, .lighthouseci) resolve against
  // the lhci cwd (WEB_DIR), not the config location.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "uoplan-lhci-"));
  const configPath = path.join(configDir, "lighthouserc.json");
  fs.writeFileSync(configPath, JSON.stringify(LH_CONFIG, null, 2));

  let status: number;
  try {
    status = run("pnpm", ["exec", "lhci", "autorun", `--config=${configPath}`], { cwd: WEB_DIR });
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true });
  }

  // Report-only: a completed run (even with low scores) is success. lhci only
  // returns non-zero here on a genuine failure (bad config, server/Chrome
  // launch failure), in which case there's no manifest to summarise.
  if (status !== 0 && !fs.existsSync(MANIFEST)) {
    die("Lighthouse CI failed to produce a report (see output above).");
  }
}

function pct(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}`.padStart(3) : "  -";
}

interface ManifestEntry {
  url: string;
  isRepresentativeRun?: boolean;
  summary?: Record<string, number>;
  htmlPath?: string;
}

function printSummary(): void {
  if (!fs.existsSync(MANIFEST)) {
    console.log("\n(no manifest found — nothing to summarise)");
    return;
  }

  const entries = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as ManifestEntry[];
  const rows = entries.filter((e) => e.isRepresentativeRun !== false);

  const labels: Record<string, string> = {
    performance: "Perf",
    accessibility: "A11y",
    "best-practices": "BestPr",
    seo: "SEO",
  };
  const header = ["Route".padEnd(42), ...CATEGORIES.map((c) => labels[c].padStart(6))].join("  ");

  console.log("\nLighthouse scores (report-only):\n");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    let route: string;
    try {
      route = new URL(row.url).pathname;
    } catch {
      route = row.url;
    }
    const cells = CATEGORIES.map((c) => pct(row.summary?.[c]).padStart(6));
    console.log([route.padEnd(42), ...cells].join("  "));
  }
  console.log(`\nFull HTML reports: ${path.relative(ROOT, path.dirname(MANIFEST))}/`);
}

function main(): void {
  // Stale reports from a previous run would otherwise be mixed in.
  fs.rmSync(path.dirname(MANIFEST), { recursive: true, force: true });

  buildWebApp();
  resolveChrome();
  audit();
  printSummary();
  // Report-only: always succeed so the pre-push hook never blocks.
  process.exit(0);
}

main();

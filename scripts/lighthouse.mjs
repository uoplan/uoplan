#!/usr/bin/env node
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
 *      `vite preview` per apps/web/lighthouserc.cjs.
 *   4. Read `.lighthouseci/manifest.json` and print a category score table.
 *
 * Env:
 *   LH_SKIP_BUILD=1   Skip the build step and audit the existing dist/client.
 *   CHROME_PATH=...   Force a specific Chrome/Chromium binary.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "apps", "web");
const MANIFEST = path.join(WEB_DIR, ".lighthouseci", "manifest.json");

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...opts });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function die(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function buildWebApp() {
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

function resolveChrome() {
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

function audit() {
  console.log("• Running Lighthouse CI…\n");
  const status = run("pnpm", ["exec", "lhci", "autorun", "--config=lighthouserc.cjs"], {
    cwd: WEB_DIR,
  });
  // Report-only: a completed run (even with low scores) is success. lhci only
  // returns non-zero here on a genuine failure (bad config, server/Chrome
  // launch failure), in which case there's no manifest to summarise.
  if (status !== 0 && !fs.existsSync(MANIFEST)) {
    die("Lighthouse CI failed to produce a report (see output above).");
  }
}

function pct(value) {
  return typeof value === "number" ? `${Math.round(value * 100)}`.padStart(3) : "  -";
}

function printSummary() {
  if (!fs.existsSync(MANIFEST)) {
    console.log("\n(no manifest found — nothing to summarise)");
    return;
  }

  /** @type {Array<{url:string,isRepresentativeRun:boolean,summary:Record<string,number>,htmlPath?:string}>} */
  const entries = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const rows = entries.filter((e) => e.isRepresentativeRun !== false);

  const labels = {
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
    let route;
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

function main() {
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

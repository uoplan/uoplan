#!/usr/bin/env node
// @ts-check
/**
 * Architecture guardrails for the uoplan monorepo.
 *
 * Two enforced invariants (run in CI; see .github/workflows/ci.yml):
 *
 *   1. Package layering — workspace packages may only depend on packages in a
 *      lower layer. This forbids upward dependencies and cycles, so the
 *      re-export shims used during the modular refactor cannot silently mask a
 *      leak (e.g. a "core" package reaching back into a "data"/"web" package).
 *
 *   2. Worker purity — the deployed Cloudflare Worker bundle must not contain
 *      `pdfjs-dist`. Transcript parsing (pdfjs) is browser-only; if it ever
 *      becomes reachable from the worker entry it bloats the bundle and pulls
 *      in DOM globals the worker can't provide.
 *
 * As packages are split/renamed through the refactor phases, update LAYERS
 * below to match the intended dependency direction.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Allowed dependency direction. Each workspace package maps to the set of
 * other workspace packages it is permitted to depend on. A package may depend
 * on anything in its list; depending on anything else (or forming a cycle)
 * fails the check. App packages (web/worker/scraper) are leaves: nothing may
 * depend on them.
 *
 * @type {Record<string, string[]>}
 */
const LAYERS = {
  "@uoplan/proto": [],
  "@uoplan/engine": [],
  "@uoplan/core": ["@uoplan/proto"],
  "@uoplan/data": ["@uoplan/proto", "@uoplan/core"],
  "@uoplan/calendar": ["@uoplan/proto", "@uoplan/core"],
  "@uoplan/transcript": ["@uoplan/proto", "@uoplan/core"],
  web: [
    "@uoplan/proto",
    "@uoplan/engine",
    "@uoplan/core",
    "@uoplan/data",
    "@uoplan/calendar",
    "@uoplan/transcript",
  ],
  worker: ["@uoplan/proto", "@uoplan/engine", "@uoplan/core", "@uoplan/data", "@uoplan/calendar"],
  scraper: ["@uoplan/proto", "@uoplan/core"],
};

const WORKSPACE_GLOBS = ["apps", "packages"];

/** @returns {Record<string, { name: string; workspaceDeps: string[] }>} */
function readWorkspacePackages() {
  /** @type {Record<string, { name: string; workspaceDeps: string[] }>} */
  const pkgs = {};
  for (const base of WORKSPACE_GLOBS) {
    const baseDir = join(repoRoot, base);
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(baseDir, entry.name, "package.json");
      let json;
      try {
        json = JSON.parse(readFileSync(pkgPath, "utf8"));
      } catch {
        continue;
      }
      const allDeps = { ...json.dependencies, ...json.devDependencies };
      const workspaceDeps = Object.keys(allDeps).filter((d) => d in LAYERS);
      pkgs[json.name] = { name: json.name, workspaceDeps };
    }
  }
  return pkgs;
}

/** @param {Record<string, { name: string; workspaceDeps: string[] }>} pkgs */
function checkLayering(pkgs) {
  /** @type {string[]} */
  const errors = [];

  for (const { name, workspaceDeps } of Object.values(pkgs)) {
    const allowed = LAYERS[name];
    if (allowed === undefined) {
      errors.push(`Package "${name}" is not declared in LAYERS (scripts/check-architecture.mjs).`);
      continue;
    }
    for (const dep of workspaceDeps) {
      if (!allowed.includes(dep)) {
        errors.push(
          `Forbidden dependency: "${name}" must not depend on "${dep}" (upward/disallowed edge).`,
        );
      }
    }
  }

  // Generic cycle detection over the actual declared edges.
  const visiting = new Set();
  const visited = new Set();
  /** @param {string} node @param {string[]} path */
  function dfs(node, path) {
    if (visiting.has(node)) {
      const cycle = [...path.slice(path.indexOf(node)), node].join(" -> ");
      errors.push(`Dependency cycle detected: ${cycle}`);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dep of pkgs[node]?.workspaceDeps ?? []) {
      dfs(dep, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }
  for (const name of Object.keys(pkgs)) dfs(name, []);

  return errors;
}

function checkWorkerBundle() {
  /** @type {string[]} */
  const errors = [];

  // `assets.directory` is no longer set in wrangler.json (the Cloudflare Vite
  // plugin populates it at build time). This standalone bundle isn't a real
  // deploy — it only needs the worker JS to scan for pdfjs — so point wrangler
  // at an (empty) assets directory via `--assets` and ensure it exists so the
  // check can run on a fresh checkout without a prior `pnpm build`.
  const assetsDir = join(repoRoot, "apps/web/dist/client");
  mkdirSync(assetsDir, { recursive: true });

  const outdir = mkdtempSync(join(tmpdir(), "uoplan-worker-bundle-"));
  try {
    execFileSync(
      "pnpm",
      [
        "--filter",
        "worker",
        "exec",
        "wrangler",
        "deploy",
        "--dry-run",
        "--assets",
        assetsDir,
        "--outdir",
        outdir,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  } catch (err) {
    const out = /** @type {{ stdout?: Buffer; stderr?: Buffer }} */ (err);
    const detail = `${out.stdout?.toString() ?? ""}${out.stderr?.toString() ?? ""}`;
    errors.push(`Failed to bundle the worker for the purity check:\n${detail}`);
    return errors;
  }

  // Scan only emitted runtime JS (not sourcemaps, which may contain path
  // strings) for pdfjs references.
  for (const file of readdirSync(outdir)) {
    if (!file.endsWith(".js")) continue;
    const contents = readFileSync(join(outdir, file), "utf8");
    if (/pdfjs/i.test(contents)) {
      errors.push(
        `Worker bundle "${file}" contains a pdfjs-dist reference; transcript parsing must stay browser-only.`,
      );
    }
  }
  return errors;
}

function checkProtoDrift() {
  /** @type {string[]} */
  const errors = [];
  const canonical = join(repoRoot, "packages/proto/proto/cli.proto");
  const vendored = join(repoRoot, "apps/cli/proto/cli.proto");
  let canonicalSrc;
  let vendoredSrc;
  try {
    canonicalSrc = readFileSync(canonical, "utf8");
    vendoredSrc = readFileSync(vendored, "utf8");
  } catch (err) {
    errors.push(
      `Could not read a cli.proto copy for the drift check: ${/** @type {Error} */ (err).message}`,
    );
    return errors;
  }
  if (canonicalSrc !== vendoredSrc) {
    errors.push(
      "apps/cli/proto/cli.proto has drifted from the canonical packages/proto/proto/cli.proto. " +
        "Run `pnpm sync:proto-cli` to re-vendor the shared schema.",
    );
  }
  return errors;
}

function readSourceFiles(dir) {
  /** @type {string[]} */
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Intra-app layering for `apps/web`. These guardrails codify the Phase 4 store
 * seams so the refactor can't silently regress:
 *   - the Zustand store must not import React components (dependency direction);
 *   - `lib/requirements` must stay framework-neutral (no React/Mantine).
 */
function checkWebInternalLayering() {
  /** @type {string[]} */
  const errors = [];
  const importRe = /(?:import|export)[^"']*from\s*["']([^"']+)["']/g;

  const storeDir = join(repoRoot, "apps/web/src/store");
  for (const file of readSourceFiles(storeDir)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      if (/(^|\/)components\//.test(spec)) {
        errors.push(
          `apps/web store must not import components: "${file.replace(repoRoot + "/", "")}" imports "${spec}".`,
        );
      }
    }
  }

  // Store slices must not import navigation/router modules directly; navigation is injected
  // via the `AppServices` seam (store/services.ts) so slices stay framework/route-agnostic.
  const slicesDir = join(repoRoot, "apps/web/src/store/slices");
  for (const file of readSourceFiles(slicesDir)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      if (/(^|\/)(appNavigation|routerRef)$/.test(spec)) {
        errors.push(
          `store slices must not import navigation/router (inject via AppServices): "${file.replace(repoRoot + "/", "")}" imports "${spec}".`,
        );
      }
    }
  }

  // Rendered code (components + hooks) must use the provider-bound store seam, never the
  // singleton: no `defaultAppStore` import and no static `useAppStore.getState/setState/subscribe`
  // (use `useAppStore(selector)` / `useAppStoreApi()` so tests can supply an isolated store).
  const renderedDirs = [
    join(repoRoot, "apps/web/src/components"),
    join(repoRoot, "apps/web/src/hooks"),
  ];
  const staticStoreRe = /\buseAppStore\s*\.\s*(getState|setState|subscribe|getInitialState)\b/;
  for (const dir of renderedDirs) {
    for (const file of readSourceFiles(dir)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const src = readFileSync(file, "utf8");
      const rel = file.replace(repoRoot + "/", "");
      if (staticStoreRe.test(src)) {
        errors.push(
          `${rel}: rendered code must not call useAppStore.getState/setState/subscribe; use useAppStoreApi() or a store action.`,
        );
      }
      for (const m of src.matchAll(importRe)) {
        if (/\bdefaultAppStore\b/.test(m[0])) {
          errors.push(
            `${rel}: rendered code must not import defaultAppStore (the singleton); use the provider-bound useAppStore/useAppStoreApi.`,
          );
        }
      }
    }
  }

  const reqDir = join(repoRoot, "apps/web/src/lib/requirements");
  for (const file of readSourceFiles(reqDir)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      if (spec === "react" || spec.startsWith("react/") || /@mantine\//.test(spec)) {
        errors.push(
          `lib/requirements must stay framework-neutral: "${file.replace(repoRoot + "/", "")}" imports "${spec}".`,
        );
      }
    }
  }

  return errors;
}

function main() {
  const pkgs = readWorkspacePackages();
  const errors = [
    ...checkLayering(pkgs),
    ...checkWebInternalLayering(),
    ...checkProtoDrift(),
    ...checkWorkerBundle(),
  ];

  if (errors.length > 0) {
    console.error("Architecture guardrails failed:\n");
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error("");
    process.exit(1);
  }

  console.log(
    "Architecture guardrails passed: package layering is acyclic, the web store is " +
      "component-free, cli.proto is in sync, and the worker bundle is pdfjs-free.",
  );
}

main();

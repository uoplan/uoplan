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
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
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
 */
const LAYERS: Record<string, string[]> = {
  "@uoplan/proto": [],
  "@uoplan/engine": [],
  "@uoplan/theme": [],
  "@uoplan/i18n": [],
  "@uoplan/navigation": [],
  "@uoplan/ui": ["@uoplan/theme"],
  "@uoplan/core": ["@uoplan/proto"],
  "@uoplan/data": ["@uoplan/proto", "@uoplan/core"],
  "@uoplan/calendar": ["@uoplan/proto", "@uoplan/core"],
  "@uoplan/transcript": ["@uoplan/proto", "@uoplan/core"],
  "@uoplan/store": ["@uoplan/proto", "@uoplan/core", "@uoplan/data"],
  "@uoplan/app": ["@uoplan/ui", "@uoplan/navigation", "@uoplan/theme", "@uoplan/i18n"],
  web: [
    "@uoplan/proto",
    "@uoplan/engine",
    "@uoplan/theme",
    "@uoplan/i18n",
    "@uoplan/navigation",
    "@uoplan/ui",
    "@uoplan/app",
    "@uoplan/core",
    "@uoplan/data",
    "@uoplan/calendar",
    "@uoplan/transcript",
    "@uoplan/store",
  ],
  worker: ["@uoplan/proto", "@uoplan/engine", "@uoplan/core", "@uoplan/data", "@uoplan/calendar"],
  // Native (Expo) app — a leaf like `web`. May consume the portable packages
  // (NOT @uoplan/transcript: pdfjs is browser-only; native gets its own impl).
  native: [
    "@uoplan/proto",
    "@uoplan/engine",
    "@uoplan/theme",
    "@uoplan/i18n",
    "@uoplan/navigation",
    "@uoplan/ui",
    "@uoplan/app",
    "@uoplan/core",
    "@uoplan/data",
    "@uoplan/calendar",
  ],
  scraper: ["@uoplan/proto", "@uoplan/core"],
};

const WORKSPACE_GLOBS = ["apps", "packages"];

interface WorkspacePkg {
  name: string;
  workspaceDeps: string[];
}

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readWorkspacePackages(): Record<string, WorkspacePkg> {
  const pkgs: Record<string, WorkspacePkg> = {};
  for (const base of WORKSPACE_GLOBS) {
    const baseDir = join(repoRoot, base);
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(baseDir, entry.name, "package.json");
      let json: PackageManifest;
      try {
        json = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageManifest;
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

function checkLayering(pkgs: Record<string, WorkspacePkg>): string[] {
  const errors: string[] = [];

  for (const { name, workspaceDeps } of Object.values(pkgs)) {
    const allowed = LAYERS[name];
    if (allowed === undefined) {
      errors.push(`Package "${name}" is not declared in LAYERS (scripts/check-architecture.ts).`);
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
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function dfs(node: string, path: string[]): void {
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

function checkWorkerBundle(): string[] {
  const errors: string[] = [];

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
    const out = err as { stdout?: Buffer; stderr?: Buffer };
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

function checkProtoDrift(): string[] {
  const errors: string[] = [];
  const canonical = join(repoRoot, "packages/proto/proto/cli.proto");
  const vendored = join(repoRoot, "apps/cli/proto/cli.proto");
  let canonicalSrc: string;
  let vendoredSrc: string;
  try {
    canonicalSrc = readFileSync(canonical, "utf8");
    vendoredSrc = readFileSync(vendored, "utf8");
  } catch (err) {
    errors.push(`Could not read a cli.proto copy for the drift check: ${(err as Error).message}`);
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

function readSourceFiles(dir: string): string[] {
  const files: string[] = [];
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
 * Invoke `onFile(src, rel, file)` for every non-test `.ts`/`.tsx` source file
 * under `dir`, where `src` is the file contents and `rel` is the repo-relative
 * path. Centralises the read-and-skip-tests loop used by the layering checks.
 */
function forEachSourceFile(
  dir: string,
  onFile: (src: string, rel: string, file: string) => void,
): void {
  for (const file of readSourceFiles(dir)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    const rel = file.replace(`${repoRoot}/`, "");
    onFile(src, rel, file);
  }
}

/**
 * Invoke `onImport(spec, statement, rel)` for every `import/export ... from
 * "spec"` statement in every non-test source file under `dir`. `statement` is
 * the full matched text (for matching default-import names etc.).
 */
function forEachSourceImport(
  dir: string,
  onImport: (spec: string, statement: string, rel: string) => void,
): void {
  const importRe = /(?:import|export)[^"']*from\s*["']([^"']+)["']/g;
  forEachSourceFile(dir, (src, rel) => {
    for (const m of src.matchAll(importRe)) {
      onImport(m[1], m[0], rel);
    }
  });
}

/**
 * Intra-app layering for `apps/web`. These guardrails codify the Phase 4 store
 * seams so the refactor can't silently regress:
 *   - the Zustand store must not import React components (dependency direction);
 *   - components/routes/lib must consume the store via the `store/hooks/**`
 *     projection hooks, never the raw `useAppStore`/`useAppStoreApi`;
 *   - `lib/requirements` must stay framework-neutral (no React/Mantine).
 */
function checkWebInternalLayering(): string[] {
  const errors: string[] = [];

  const storeDir = join(repoRoot, "apps/web/src/store");
  forEachSourceImport(storeDir, (spec, _statement, rel) => {
    if (/(^|\/)components\//.test(spec)) {
      errors.push(`apps/web store must not import components: "${rel}" imports "${spec}".`);
    }
  });

  // Store slices must not import navigation/router modules directly; navigation is injected
  // via the `AppServices` seam (store/services.ts) so slices stay framework/route-agnostic.
  const slicesDir = join(repoRoot, "apps/web/src/store/slices");
  forEachSourceImport(slicesDir, (spec, _statement, rel) => {
    if (/(^|\/)(appNavigation|routerRef)$/.test(spec)) {
      errors.push(
        `store slices must not import navigation/router (inject via AppServices): "${rel}" imports "${spec}".`,
      );
    }
  });

  // Rendered code (components + hooks) must use the provider-bound store seam, never the
  // singleton: no `defaultAppStore` import and no static `useAppStore.getState/setState/subscribe`
  // (use `useAppStore(selector)` / `useAppStoreApi()` so tests can supply an isolated store).
  const renderedDirs = [
    join(repoRoot, "apps/web/src/components"),
    join(repoRoot, "apps/web/src/hooks"),
  ];
  const staticStoreRe = /\buseAppStore\s*\.\s*(getState|setState|subscribe|getInitialState)\b/;
  for (const dir of renderedDirs) {
    forEachSourceFile(dir, (src, rel) => {
      if (staticStoreRe.test(src)) {
        errors.push(
          `${rel}: rendered code must not call useAppStore.getState/setState/subscribe; use useAppStoreApi() or a store action.`,
        );
      }
    });
    forEachSourceImport(dir, (_spec, statement, rel) => {
      if (/\bdefaultAppStore\b/.test(statement)) {
        errors.push(
          `${rel}: rendered code must not import defaultAppStore (the singleton); use the provider-bound useAppStore/useAppStoreApi.`,
        );
      }
    });
  }

  // Projection-hooks layer: components/routes/lib must consume the store through the
  // domain hooks in `store/hooks/**` (re-rendering + field-coupling are encapsulated there),
  // never by importing the raw `useAppStore`/`useAppStoreApi` from `store/appStore`. The
  // `store/hooks/**` layer and the existing cross-cutting `hooks/**` are the only sanctioned
  // direct consumers (allowlisted by virtue of not being scanned here).
  const projectionConsumerDirs = [
    join(repoRoot, "apps/web/src/components"),
    join(repoRoot, "apps/web/src/routes"),
    join(repoRoot, "apps/web/src/lib"),
  ];
  const appStoreSpecRe = /(^|\/)store\/appStore$/;
  const rawStoreHookRe = /\buseAppStore(Api)?\b/;
  for (const dir of projectionConsumerDirs) {
    forEachSourceImport(dir, (spec, statement, rel) => {
      if (appStoreSpecRe.test(spec) && rawStoreHookRe.test(statement)) {
        errors.push(
          `${rel}: components/routes/lib must consume the store via the projection hooks in ` +
            `store/hooks, not useAppStore/useAppStoreApi from "${spec}".`,
        );
      }
    });
  }

  const reqDir = join(repoRoot, "apps/web/src/lib/requirements");
  forEachSourceImport(reqDir, (spec, _statement, rel) => {
    if (spec === "react" || spec.startsWith("react/") || /@mantine\//.test(spec)) {
      errors.push(`lib/requirements must stay framework-neutral: "${rel}" imports "${spec}".`);
    }
  });

  return errors;
}

/**
 * `@uoplan/app` write-once purity: shared screens must be authored ONLY against
 * the abstract contract packages (ui/navigation/theme/i18n) + logic packages —
 * never platform primitives or a concrete router. A leaked `@mantine/*`,
 * `react-native`, or router import here would break the "implement each screen
 * once, swap leaves per platform" guarantee (the linchpin of the whole design).
 */
function checkAppPurity(): string[] {
  const errors: string[] = [];
  const appDir = join(repoRoot, "packages/app/src");
  forEachSourceImport(appDir, (spec, _statement, rel) => {
    if (
      /@mantine\//.test(spec) ||
      spec === "react-native" ||
      spec.startsWith("react-native/") ||
      spec.startsWith("react-native-") ||
      spec === "@tanstack/react-router" ||
      spec === "expo-router"
    ) {
      errors.push(
        `@uoplan/app must stay platform-agnostic (use the ui/navigation contract, not platform ` +
          `primitives or a router): "${rel}" imports "${spec}".`,
      );
    }
  });
  return errors;
}

/**
 * `@uoplan/store` purity: planner state must stay reusable across web/native and
 * safe to import during prerender. Platform UI, concrete routers, browser-only
 * transcript code, and app-source backedges belong in app adapters, not here.
 */
function checkStorePurity(): string[] {
  const errors: string[] = [];
  const storeDir = join(repoRoot, "packages/store/src");
  forEachSourceImport(storeDir, (spec, _statement, rel) => {
    if (
      /@mantine\//.test(spec) ||
      /@tanstack\//.test(spec) ||
      spec === "pdfjs-dist" ||
      spec.startsWith("pdfjs-dist/") ||
      spec === "@uoplan/i18n" ||
      spec.startsWith("@uoplan/i18n/") ||
      spec === "react-native" ||
      spec.startsWith("react-native/") ||
      spec.startsWith("react-native-") ||
      spec === "expo" ||
      spec.startsWith("expo-")
    ) {
      errors.push(
        `@uoplan/store must stay platform-agnostic and browser-safe: "${rel}" imports "${spec}".`,
      );
    }

    if (spec.startsWith("apps/")) {
      errors.push(`@uoplan/store must not import app source: "${rel}" imports "${spec}".`);
      return;
    }

    if (spec.startsWith(".")) {
      const resolved = resolve(dirname(join(repoRoot, rel)), spec);
      const appsDir = join(repoRoot, "apps");
      if (resolved === appsDir || resolved.startsWith(`${appsDir}/`)) {
        errors.push(`@uoplan/store must not import app source: "${rel}" imports "${spec}".`);
      }
    }
  });
  return errors;
}

function main(): void {
  const pkgs = readWorkspacePackages();
  const errors = [
    ...checkLayering(pkgs),
    ...checkWebInternalLayering(),
    ...checkAppPurity(),
    ...checkStorePurity(),
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

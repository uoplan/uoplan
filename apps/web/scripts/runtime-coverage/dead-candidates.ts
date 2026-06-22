import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import libCoverage from "istanbul-lib-coverage";
import type { CoverageMap, CoverageMapData, FileCoverage, Range } from "istanbul-lib-coverage";

/**
 * Reads every runtime-coverage snapshot in `apps/web/.nyc_output/` (written by
 * the dev-server collector while you walk the instrumented app), merges them,
 * and ranks code the running app NEVER executed — the candidate list for
 * dead-code deletion.
 *
 * ⚠️ Uncovered ≠ dead. A function showing 0 hits only means *these sessions*
 * never ran it; it may be a real error/edge path you didn't exercise. Treat the
 * output as a prioritized review list, not an auto-delete list. Confirm intent +
 * static reachability before removing anything.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..", ".."); // apps/web/scripts/runtime-coverage -> apps/web
const repoRoot = path.resolve(webRoot, "..", "..");

export interface ColdFunction {
  file: string;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
}

export interface FileStats {
  file: string;
  statementPct: number;
  functionPct: number;
  totalFns: number;
  coldFns: number;
  coldFnLoc: number;
  fileLoc: number;
  fullyCold: boolean;
}

export interface NeverLoadedFile {
  file: string;
  loc: number;
}

export interface DeadCandidateReport {
  generatedAt: string;
  snapshotCount: number;
  instrumentedFiles: number;
  diskFiles: number;
  neverLoadedFiles: NeverLoadedFile[];
  fullyColdFiles: FileStats[];
  coldFunctions: ColdFunction[];
  partialFiles: FileStats[];
  totals: {
    neverLoadedLoc: number;
    fullyColdFileLoc: number;
    coldFunctionLoc: number;
    estimatedDeadLoc: number;
  };
}

function rel(file: string): string {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

const INSTRUMENT_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** Mirrors the istanbul include/exclude in vite.config.ts. */
function isInstrumentable(absPath: string): boolean {
  const r = path.relative(path.join(webRoot, "src"), absPath).replaceAll(path.sep, "/");
  if (r.startsWith("..")) return false;
  if (!INSTRUMENT_EXT.has(path.extname(absPath))) return false;
  if (/\.(test|browser\.test)\.[tj]sx?$/.test(r)) return false;
  if (r.endsWith(".d.ts")) return false;
  if (r === "routeTree.gen.ts") return false;
  if (r.startsWith("test/") || r.startsWith("workers/")) return false;
  return true;
}

function walkSrc(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSrc(full, out);
    } else if (entry.isFile() && isInstrumentable(full)) {
      out.push(full);
    }
  }
}

function countLines(absPath: string): number {
  try {
    const text = fs.readFileSync(absPath, "utf8");
    if (text.length === 0) return 0;
    return text.split("\n").length;
  } catch {
    return 0;
  }
}

function rangeLoc(loc: Range): number {
  const start = loc.start?.line ?? 0;
  const end = loc.end?.line ?? start;
  return Math.max(1, end - start + 1);
}

function loadCoverageMap(nycDir: string): { map: CoverageMap; snapshots: number } {
  const map = libCoverage.createCoverageMap({});
  let snapshots = 0;
  if (!fs.existsSync(nycDir)) return { map, snapshots };
  for (const name of fs.readdirSync(nycDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(nycDir, name), "utf8")) as CoverageMapData;
      map.merge(raw);
      snapshots++;
    } catch {
      // skip malformed snapshot
    }
  }
  return { map, snapshots };
}

function coldFunctionsFor(fc: FileCoverage, file: string): ColdFunction[] {
  const out: ColdFunction[] = [];
  const fnMap = fc.fnMap;
  const hits = fc.f;
  for (const id of Object.keys(fnMap)) {
    if ((hits[id] ?? 0) !== 0) continue;
    const meta = fnMap[id];
    const span = meta.loc ?? meta.decl;
    const startLine = span?.start?.line ?? 0;
    const endLine = span?.end?.line ?? startLine;
    out.push({
      file: rel(file),
      name: meta.name || "(anonymous)",
      startLine,
      endLine,
      loc: rangeLoc(span),
    });
  }
  return out;
}

export function analyze(nycDir: string): DeadCandidateReport {
  const { map, snapshots } = loadCoverageMap(nycDir);
  const fullyColdFiles: FileStats[] = [];
  const partialFiles: FileStats[] = [];
  const coldFunctions: ColdFunction[] = [];

  for (const file of map.files()) {
    const fc = map.fileCoverageFor(file);
    const summary = fc.toSummary();
    const fnIds = Object.keys(fc.fnMap);
    const cold = coldFunctionsFor(fc, file);
    const coldFnLoc = cold.reduce((acc, f) => acc + f.loc, 0);
    const lineKeys = Object.keys(fc.getLineCoverage());
    const fileLoc = lineKeys.length;

    const stats: FileStats = {
      file: rel(file),
      statementPct: summary.statements.pct,
      functionPct: summary.functions.pct,
      totalFns: fnIds.length,
      coldFns: cold.length,
      coldFnLoc,
      fileLoc,
      fullyCold: summary.statements.covered === 0,
    };

    if (stats.fullyCold) {
      fullyColdFiles.push(stats);
    } else if (cold.length > 0) {
      coldFunctions.push(...cold);
      partialFiles.push(stats);
    }
  }

  fullyColdFiles.sort((a, b) => b.fileLoc - a.fileLoc);
  partialFiles.sort((a, b) => b.coldFnLoc - a.coldFnLoc);
  coldFunctions.sort((a, b) => b.loc - a.loc);

  // Files that exist on disk but never appeared in ANY snapshot = never imported
  // by a crawled route. With on-demand dev instrumentation these are invisible
  // to the coverage map entirely, so we diff against the disk universe — this is
  // the strongest whole-file dead candidate signal.
  const loaded = new Set(map.files().map((f) => path.resolve(f)));
  const diskFiles: string[] = [];
  walkSrc(path.join(webRoot, "src"), diskFiles);
  const neverLoadedFiles: NeverLoadedFile[] = diskFiles
    .filter((f) => !loaded.has(path.resolve(f)))
    .map((f) => ({ file: rel(f), loc: countLines(f) }))
    .sort((a, b) => b.loc - a.loc);

  const neverLoadedLoc = neverLoadedFiles.reduce((acc, f) => acc + f.loc, 0);
  const fullyColdFileLoc = fullyColdFiles.reduce((acc, f) => acc + f.fileLoc, 0);
  const coldFunctionLoc = coldFunctions.reduce((acc, f) => acc + f.loc, 0);

  return {
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots,
    instrumentedFiles: map.files().length,
    diskFiles: diskFiles.length,
    neverLoadedFiles,
    fullyColdFiles,
    coldFunctions,
    partialFiles,
    totals: {
      neverLoadedLoc,
      fullyColdFileLoc,
      coldFunctionLoc,
      estimatedDeadLoc: neverLoadedLoc + fullyColdFileLoc + coldFunctionLoc,
    },
  };
}

function renderMarkdown(report: DeadCandidateReport): string {
  const lines: string[] = [];
  lines.push("# Runtime dead-code candidates");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Snapshots merged: ${report.snapshotCount} · loaded files: ${report.instrumentedFiles} / ${report.diskFiles} on disk`,
  );
  lines.push("");
  lines.push("> ⚠️ Uncovered ≠ dead. These are files/functions that never ran during the");
  lines.push("> recorded sessions (here: an automated route crawl). A never-loaded file may");
  lines.push("> just be reachable only through UI the crawl didn't drive. Confirm intent +");
  lines.push("> static reachability (imports across ALL workspaces) before deleting.");
  lines.push("");
  lines.push("## Headline");
  lines.push("");
  lines.push(
    `- Never-loaded files (never imported by any crawled route): **${report.neverLoadedFiles.length}** (~${report.totals.neverLoadedLoc} LOC)`,
  );
  lines.push(
    `- Fully-cold loaded files (imported, 0% executed): **${report.fullyColdFiles.length}** (~${report.totals.fullyColdFileLoc} LOC)`,
  );
  lines.push(
    `- Cold functions in live files: **${report.coldFunctions.length}** (~${report.totals.coldFunctionLoc} LOC)`,
  );
  lines.push(`- Estimated never-executed LOC: **~${report.totals.estimatedDeadLoc}**`);
  lines.push("");

  lines.push("## Never-loaded files (never imported — top dead-file candidates)");
  lines.push("");
  if (report.neverLoadedFiles.length === 0) {
    lines.push("_none_");
  } else {
    lines.push("| file | ~LOC |");
    lines.push("| --- | ---: |");
    for (const f of report.neverLoadedFiles) {
      lines.push(`| ${f.file} | ${f.loc} |`);
    }
  }
  lines.push("");

  lines.push("## Fully-cold loaded files (imported but 0% executed)");
  lines.push("");
  if (report.fullyColdFiles.length === 0) {
    lines.push("_none_");
  } else {
    lines.push("| file | ~LOC | functions |");
    lines.push("| --- | ---: | ---: |");
    for (const f of report.fullyColdFiles) {
      lines.push(`| ${f.file} | ${f.fileLoc} | ${f.totalFns} |`);
    }
  }
  lines.push("");

  lines.push("## Cold functions in otherwise-live files (top 100 by LOC)");
  lines.push("");
  lines.push("| file:lines | function | ~LOC |");
  lines.push("| --- | --- | ---: |");
  for (const fn of report.coldFunctions.slice(0, 100)) {
    lines.push(`| ${fn.file}:${fn.startLine}-${fn.endLine} | \`${fn.name}\` | ${fn.loc} |`);
  }
  lines.push("");

  lines.push("## Files with the most cold-function LOC (top 40)");
  lines.push("");
  lines.push("| file | stmt% | fn% | cold fns | ~cold LOC |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const f of report.partialFiles.slice(0, 40)) {
    lines.push(
      `| ${f.file} | ${f.statementPct.toFixed(0)} | ${f.functionPct.toFixed(0)} | ${f.coldFns} | ${f.coldFnLoc} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  const nycDir = path.join(webRoot, ".nyc_output");
  const outDir = path.join(webRoot, "coverage-runtime");
  fs.mkdirSync(outDir, { recursive: true });

  const report = analyze(nycDir);
  fs.writeFileSync(path.join(outDir, "dead-candidates.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "dead-candidates.md"), renderMarkdown(report));

  if (report.snapshotCount === 0) {
    console.warn(
      "[coverage] No snapshots found in apps/web/.nyc_output. Run `pnpm --filter web coverage:dev`, walk the app, then re-run this.",
    );
  }
  console.info(
    `[coverage] ${report.snapshotCount} snapshot(s) · ${report.neverLoadedFiles.length} never-loaded + ${report.fullyColdFiles.length} fully-cold files · ${report.coldFunctions.length} cold functions · ~${report.totals.estimatedDeadLoc} never-executed LOC`,
  );
  console.info("[coverage] wrote coverage-runtime/dead-candidates.{md,json}");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

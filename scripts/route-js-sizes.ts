/**
 * Route JS size report. Measures the built web app's initial landing graph
 * from index.html, then estimates route graphs by combining route chunks found
 * through sourcemaps with each chunk's transitive static imports.
 *
 * Run `pnpm --filter web build` first when apps/web/dist/client is missing, then:
 *   node scripts/route-js-sizes.ts            # print a table
 *   node scripts/route-js-sizes.ts --json     # machine-readable JSON
 *   node scripts/route-js-sizes.ts --save foo # also write scripts/.size-snapshots/route-js-foo.json
 *   node scripts/route-js-sizes.ts --diff foo # compare current vs a saved route-js snapshot
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = join(repoRoot, "apps/web/dist/client");
const ROUTE_TREE_PATH = join(repoRoot, "apps/web/src/routeTree.gen.ts");
const SNAPSHOT_DIR = join(repoRoot, "scripts/.size-snapshots");

export interface ChunkSize {
  id: string;
  raw: number;
  gzip: number;
  imports: string[];
  routeSources: string[];
}

export interface GraphSize {
  id: string;
  label: string;
  chunkCount: number;
  raw: number;
  gzip: number;
  chunks: string[];
  missing: string[];
}

export interface RouteGraphSize extends GraphSize {
  route: string;
  routeChunks: string[];
}

export interface RouteTreeMapping {
  fullPath: string;
  importName: string;
  routeSource: string;
}

export interface SizeReport {
  clientDir: string;
  initial: GraphSize;
  routes: RouteGraphSize[];
  chunks: ChunkSize[];
  total: GraphSize;
  warnings: string[];
}

interface CollectOptions {
  clientDir?: string;
  routeTreePath?: string;
}

interface ChunkRecord extends ChunkSize {
  absolutePath: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function stripQueryAndHash(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function toChunkId(reference: string): string | undefined {
  const withoutQuery = stripQueryAndHash(reference.trim());
  const normalized = withoutQuery.replace(/^\/+/, "").replace(/^\.\//, "");
  if (!normalized.endsWith(".js")) return undefined;
  return normalized;
}

function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern = /\s([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(attrPattern)) {
    const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
    if (!rawName) continue;
    attrs.set(rawName.toLowerCase(), doubleQuoted ?? singleQuoted ?? unquoted ?? "");
  }
  return attrs;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function parseInitialGraphReferences(html: string): string[] {
  const scriptRefs: string[] = [];
  const preloadRefs: string[] = [];

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.get("type") !== "module") continue;
    const src = attrs.get("src");
    if (!src) continue;
    const id = toChunkId(src);
    if (id) scriptRefs.push(id);
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const rel = attrs.get("rel")?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes("modulepreload")) continue;
    const href = attrs.get("href");
    if (!href) continue;
    const id = toChunkId(href);
    if (id) preloadRefs.push(id);
  }

  return uniqueSorted([...scriptRefs, ...preloadRefs]);
}

export function parseStaticImportSpecifiers(js: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /(?:^|[;\n])\s*import\s*["']([^"']+)["']/g,
    /(?:^|[;\n])\s*import(?!\s*[.(])[^;]*?\bfrom\s*["']([^"']+)["']/g,
    /(?:^|[;\n])\s*export[^;]*?\bfrom\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of js.matchAll(pattern)) {
      const spec = match[1];
      if (spec && toChunkId(spec)) specs.push(spec);
    }
  }

  return uniqueSorted(specs);
}

function normalizeRouteSource(source: string): string | undefined {
  const withoutQuery = stripQueryAndHash(source).replaceAll("\\", "/");
  const srcIndex = withoutQuery.indexOf("src/routes/");
  if (srcIndex === -1) return undefined;
  return withoutQuery.slice(srcIndex).replace(/\.(?:tsx|ts|jsx|js)$/, "");
}

export function parseRouteTreeMappings(routeTreeContent: string): RouteTreeMapping[] {
  const importsByName = new Map<string, string>();
  const importPattern = /import\s+\{\s*Route\s+as\s+(\w+)\s*\}\s+from\s+['"]\.\/([^'"]+)['"]/g;
  for (const match of routeTreeContent.matchAll(importPattern)) {
    const [, importName, routeImport] = match;
    if (!importName || !routeImport) continue;
    importsByName.set(importName, `src/${routeImport.replace(/\.(?:tsx|ts|jsx|js)$/, "")}`);
  }

  const mappings: RouteTreeMapping[] = [];
  const routeBlockPattern = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n\s*\}/g;
  for (const match of routeTreeContent.matchAll(routeBlockPattern)) {
    const [, routeKey, body] = match;
    if (!routeKey || !body) continue;
    const importName = /preLoaderRoute:\s*typeof\s+(\w+)/.exec(body)?.[1];
    if (!importName) continue;
    const routeSource = importsByName.get(importName);
    if (!routeSource) continue;
    const fullPath = /fullPath:\s*['"]([^'"]+)['"]/.exec(body)?.[1] ?? routeKey;
    mappings.push({ fullPath, importName, routeSource });
  }

  return mappings.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
}

function resolveImportId(fromId: string, spec: string): string | undefined {
  const cleanSpec = stripQueryAndHash(spec);
  if (cleanSpec.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(fromId), cleanSpec));
  }
  return toChunkId(cleanSpec);
}

function readRouteSourcesForChunk(jsPath: string): string[] {
  const mapPath = `${jsPath}.map`;
  if (!existsSync(mapPath)) return [];
  const parsed = JSON.parse(readFileSync(mapPath, "utf8")) as { sources?: unknown };
  if (!Array.isArray(parsed.sources)) return [];
  return uniqueSorted(
    parsed.sources
      .filter((source): source is string => typeof source === "string")
      .map((source) => normalizeRouteSource(source))
      .filter((source): source is string => Boolean(source)),
  );
}

function collectChunks(clientDir: string): ChunkRecord[] {
  const assetsDir = join(clientDir, "assets");
  if (!existsSync(assetsDir)) {
    throw new Error(`No assets dir at ${assetsDir}. Run \`pnpm --filter web build\` first.`);
  }

  const ids = readdirSync(assetsDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => `assets/${file}`)
    .sort();
  const idSet = new Set(ids);

  return ids.map((id) => {
    const absolutePath = join(clientDir, id);
    const bytes = readFileSync(absolutePath);
    const text = bytes.toString("utf8");
    const imports = uniqueSorted(
      parseStaticImportSpecifiers(text)
        .map((spec) => resolveImportId(id, spec))
        .filter(
          (importId): importId is string => typeof importId === "string" && idSet.has(importId),
        ),
    );
    return {
      absolutePath,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
      id,
      imports,
      raw: bytes.byteLength,
      routeSources: readRouteSourcesForChunk(absolutePath),
    };
  });
}

function buildGraph(
  id: string,
  label: string,
  startIds: string[],
  chunksById: Map<string, ChunkRecord>,
): GraphSize {
  const missing = new Set<string>();
  const seen = new Set<string>();
  const stack = [...startIds];

  while (stack.length > 0) {
    const chunkId = stack.pop();
    if (!chunkId || seen.has(chunkId)) continue;
    const chunk = chunksById.get(chunkId);
    if (!chunk) {
      missing.add(chunkId);
      continue;
    }
    seen.add(chunkId);
    for (const importId of chunk.imports) stack.push(importId);
  }

  const chunks = uniqueSorted(seen);
  return {
    chunkCount: chunks.length,
    chunks,
    gzip: chunks.reduce((total, chunkId) => total + (chunksById.get(chunkId)?.gzip ?? 0), 0),
    id,
    label,
    missing: [...missing].sort(),
    raw: chunks.reduce((total, chunkId) => total + (chunksById.get(chunkId)?.raw ?? 0), 0),
  };
}

function ancestorPaths(fullPath: string, knownRoutes: Set<string>): string[] {
  if (fullPath === "/") return knownRoutes.has("/") ? ["/"] : [];
  const withoutTrailingSlash = fullPath.endsWith("/") ? fullPath.slice(0, -1) : fullPath;
  const parts = withoutTrailingSlash.split("/").filter(Boolean);
  const ancestors = parts.map((_, index) => `/${parts.slice(0, index + 1).join("/")}`);
  const result = ancestors.filter((path) => knownRoutes.has(path));
  if (fullPath.endsWith("/") && knownRoutes.has(fullPath)) result.push(fullPath);
  if (!fullPath.endsWith("/") && knownRoutes.has(fullPath) && !result.includes(fullPath)) {
    result.push(fullPath);
  }
  return uniqueSorted(result);
}

function graphFromChunks(chunks: ChunkRecord[]): GraphSize {
  const ids = chunks.map((chunk) => chunk.id);
  return {
    chunkCount: chunks.length,
    chunks: ids,
    gzip: chunks.reduce((total, chunk) => total + chunk.gzip, 0),
    id: "all-js",
    label: "all built JS chunks",
    missing: [],
    raw: chunks.reduce((total, chunk) => total + chunk.raw, 0),
  };
}

export function collectReport(options: CollectOptions = {}): SizeReport {
  const clientDir = resolve(options.clientDir ?? CLIENT_DIR);
  const routeTreePath = resolve(options.routeTreePath ?? ROUTE_TREE_PATH);
  const indexPath = join(clientDir, "index.html");
  if (!existsSync(clientDir)) {
    throw new Error(`No built client at ${clientDir}. Run \`pnpm --filter web build\` first.`);
  }
  if (!existsSync(indexPath)) {
    throw new Error(`No entry HTML at ${indexPath}. Run \`pnpm --filter web build\` first.`);
  }

  const chunks = collectChunks(clientDir);
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const initialIds = parseInitialGraphReferences(readFileSync(indexPath, "utf8"));
  const initial = buildGraph("initial:/", "initial landing / graph", initialIds, chunksById);
  const warnings = [...initial.missing].map(
    (id) => `index.html references missing JS chunk: ${id}`,
  );

  let routes: RouteGraphSize[] = [];
  if (!existsSync(routeTreePath)) {
    warnings.push(`No route tree at ${routeTreePath}; per-route graphs skipped.`);
  } else if (chunks.every((chunk) => chunk.routeSources.length === 0)) {
    warnings.push("No route sourcemap entries found; per-route graphs skipped.");
  } else {
    const mappings = parseRouteTreeMappings(readFileSync(routeTreePath, "utf8"));
    const routeSourcesByPath = new Map(
      mappings.map((mapping) => [mapping.fullPath, mapping.routeSource]),
    );
    const routeChunksBySource = new Map<string, string[]>();
    for (const chunk of chunks) {
      for (const source of chunk.routeSources) {
        routeChunksBySource.set(source, [...(routeChunksBySource.get(source) ?? []), chunk.id]);
      }
    }

    const knownRoutes = new Set(routeSourcesByPath.keys());
    routes = mappings.map((mapping) => {
      const routeChunkIds = uniqueSorted(
        ancestorPaths(mapping.fullPath, knownRoutes).flatMap((path) => {
          const source = routeSourcesByPath.get(path);
          return source ? (routeChunksBySource.get(source) ?? []) : [];
        }),
      );
      const graph = buildGraph(
        `route:${mapping.fullPath}`,
        `${mapping.fullPath} initial graph`,
        [...initial.chunks, ...routeChunkIds],
        chunksById,
      );
      return {
        ...graph,
        route: mapping.fullPath,
        routeChunks: routeChunkIds,
      };
    });
  }

  return {
    chunks: chunks.map(({ absolutePath: _absolutePath, ...chunk }) => chunk),
    clientDir,
    initial,
    routes,
    total: graphFromChunks(chunks),
    warnings,
  };
}

function printGraphTable(graphs: GraphSize[]): void {
  const labelW = Math.max(...graphs.map((graph) => graph.label.length), 5);
  console.log(
    `${"graph".padEnd(labelW)}  ${"chunks".padStart(6)}  ${"raw".padStart(12)}  ${"gzip".padStart(12)}`,
  );
  console.log("-".repeat(labelW + 36));
  for (const graph of graphs) {
    console.log(
      `${graph.label.padEnd(labelW)}  ${fmt(graph.chunkCount).padStart(6)}  ${fmt(graph.raw).padStart(12)}  ${fmt(graph.gzip).padStart(12)}`,
    );
  }
}

function printChunkTable(chunks: ChunkSize[], limit = 25): void {
  const shown = [...chunks].sort((a, b) => b.gzip - a.gzip).slice(0, limit);
  const idW = Math.max(...shown.map((chunk) => chunk.id.length), 5);
  console.log(
    `${"chunk".padEnd(idW)}  ${"raw".padStart(12)}  ${"gzip".padStart(12)}  ${"imports".padStart(7)}`,
  );
  console.log("-".repeat(idW + 35));
  for (const chunk of shown) {
    console.log(
      `${chunk.id.padEnd(idW)}  ${fmt(chunk.raw).padStart(12)}  ${fmt(chunk.gzip).padStart(12)}  ${fmt(chunk.imports.length).padStart(7)}`,
    );
  }
}

function printReport(report: SizeReport): void {
  console.log("Initial JS graph");
  printGraphTable([report.initial]);

  if (report.routes.length > 0) {
    console.log("\nPer-route initial JS graphs (initial / graph + route chunks + static imports)");
    printGraphTable(report.routes);
  }

  console.log("\nLargest JS chunks by gzip");
  printChunkTable(report.chunks);

  console.log("\nBuilt JS total");
  printGraphTable([report.total]);

  for (const warning of report.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

function snapshotPath(name: string): string {
  const clean = name.replace(/\.json$/, "");
  const fileName = clean.startsWith("route-js-") ? `${clean}.json` : `route-js-${clean}.json`;
  return join(SNAPSHOT_DIR, fileName);
}

function loadSnapshot(name: string): SizeReport {
  const path = snapshotPath(name);
  if (!existsSync(path)) throw new Error(`No snapshot at ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as SizeReport;
}

function graphDiffRows(report: SizeReport): Map<string, GraphSize> {
  return new Map([
    [report.initial.id, report.initial],
    ...report.routes.map((route) => [route.id, route] as const),
  ]);
}

function printDiff(current: SizeReport, base: SizeReport): void {
  const baseById = graphDiffRows(base);
  const currentById = graphDiffRows(current);
  const ids = uniqueSorted([...baseById.keys(), ...currentById.keys()]);
  const labelW = Math.max(
    ...ids.map(
      (id) => currentById.get(id)?.label.length ?? baseById.get(id)?.label.length ?? id.length,
    ),
    5,
  );

  console.log(
    `${"graph".padEnd(labelW)}  ${"chunks Δ".padStart(9)}  ${"gzip Δ".padStart(14)}  ${"gzip now".padStart(12)}`,
  );
  console.log("-".repeat(labelW + 41));
  for (const id of ids) {
    const baseGraph = baseById.get(id);
    const currentGraph = currentById.get(id);
    const label = currentGraph?.label ?? baseGraph?.label ?? id;
    const chunkDelta = (currentGraph?.chunkCount ?? 0) - (baseGraph?.chunkCount ?? 0);
    const gzipDelta = (currentGraph?.gzip ?? 0) - (baseGraph?.gzip ?? 0);
    const chunkSign = chunkDelta > 0 ? "+" : "";
    const gzipSign = gzipDelta > 0 ? "+" : "";
    console.log(
      `${label.padEnd(labelW)}  ${`${chunkSign}${fmt(chunkDelta)}`.padStart(9)}  ${`${gzipSign}${fmt(gzipDelta)}`.padStart(14)}  ${fmt(currentGraph?.gzip ?? 0).padStart(12)}`,
    );
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const report = collectReport();

  const diffIdx = args.indexOf("--diff");
  if (diffIdx !== -1) {
    printDiff(report, loadSnapshot(args[diffIdx + 1] ?? ""));
    return;
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  const saveIdx = args.indexOf("--save");
  if (saveIdx !== -1) {
    const name = args[saveIdx + 1];
    if (!name) throw new Error("--save requires a snapshot name");
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const path = snapshotPath(name);
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(
      `\nSaved snapshot → ${posix.join("scripts/.size-snapshots", posix.basename(path))}`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

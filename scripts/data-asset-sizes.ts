/**
 * Data-asset size report. Lists every built `.pb` asset in the web app's
 * assets/data directory with its raw and gzipped size, so a data / proto change
 * can be size-justified (before vs after).
 *
 * Run `pnpm build:data-proto` first to (re)generate the assets, then:
 *   node scripts/data-asset-sizes.ts            # print a table
 *   node scripts/data-asset-sizes.ts --json     # machine-readable JSON
 *   node scripts/data-asset-sizes.ts --save foo # also write a snapshot to
 *                                                # scripts/.size-snapshots/foo.json
 *   node scripts/data-asset-sizes.ts --diff foo # compare current vs a saved snapshot
 */

import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(repoRoot, "apps/web/src/assets/data");
const SNAPSHOT_DIR = join(repoRoot, "scripts/.size-snapshots");

interface AssetSize {
  id: string;
  raw: number;
  gzip: number;
}

function collect(): AssetSize[] {
  if (!existsSync(DATA_DIR)) {
    throw new Error(`No data dir at ${DATA_DIR}. Run \`pnpm build:data-proto\` first.`);
  }
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".pb"))
    .sort();
  return files.map((id) => {
    const bytes = readFileSync(join(DATA_DIR, id));
    return { id, raw: bytes.byteLength, gzip: gzipSync(bytes, { level: 9 }).byteLength };
  });
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function printTable(sizes: AssetSize[]): void {
  const byGzip = [...sizes].sort((a, b) => b.gzip - a.gzip);
  const idW = Math.max(...sizes.map((s) => s.id.length), 5);
  console.log(`${"asset".padEnd(idW)}  ${"raw".padStart(12)}  ${"gzip".padStart(12)}`);
  console.log("-".repeat(idW + 28));
  for (const s of byGzip) {
    console.log(`${s.id.padEnd(idW)}  ${fmt(s.raw).padStart(12)}  ${fmt(s.gzip).padStart(12)}`);
  }
  const totalRaw = sizes.reduce((a, s) => a + s.raw, 0);
  const totalGzip = sizes.reduce((a, s) => a + s.gzip, 0);
  console.log("-".repeat(idW + 28));
  console.log(
    `${"TOTAL".padEnd(idW)}  ${fmt(totalRaw).padStart(12)}  ${fmt(totalGzip).padStart(12)}`,
  );
}

function loadSnapshot(name: string): AssetSize[] {
  const p = join(SNAPSHOT_DIR, `${name}.json`);
  if (!existsSync(p)) throw new Error(`No snapshot at ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as AssetSize[];
}

function printDiff(current: AssetSize[], base: AssetSize[]): void {
  const baseById = new Map(base.map((s) => [s.id, s]));
  const curById = new Map(current.map((s) => [s.id, s]));
  const ids = [...new Set([...baseById.keys(), ...curById.keys()])].sort();
  const idW = Math.max(...ids.map((s) => s.length), 5);
  console.log(`${"asset".padEnd(idW)}  ${"gzip Δ".padStart(14)}  ${"gzip now".padStart(12)}`);
  console.log("-".repeat(idW + 32));
  let deltaTotal = 0;
  for (const id of ids) {
    const b = baseById.get(id)?.gzip ?? 0;
    const c = curById.get(id)?.gzip ?? 0;
    const d = c - b;
    deltaTotal += d;
    const sign = d > 0 ? "+" : "";
    console.log(`${id.padEnd(idW)}  ${`${sign}${fmt(d)}`.padStart(14)}  ${fmt(c).padStart(12)}`);
  }
  console.log("-".repeat(idW + 32));
  const sign = deltaTotal > 0 ? "+" : "";
  console.log(`${"TOTAL Δ".padEnd(idW)}  ${`${sign}${fmt(deltaTotal)}`.padStart(14)}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const sizes = collect();

  const diffIdx = args.indexOf("--diff");
  if (diffIdx !== -1) {
    printDiff(sizes, loadSnapshot(args[diffIdx + 1] ?? ""));
    return;
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(sizes, null, 2));
  } else {
    printTable(sizes);
  }

  const saveIdx = args.indexOf("--save");
  if (saveIdx !== -1) {
    const name = args[saveIdx + 1];
    if (!name) throw new Error("--save requires a snapshot name");
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(join(SNAPSHOT_DIR, `${name}.json`), JSON.stringify(sizes, null, 2));
    console.log(`\nSaved snapshot → scripts/.size-snapshots/${name}.json`);
  }
}

main();

/**
 * Data-asset size report. Lists every built `.pb` asset in the web app's
 * assets/data directory (including per-school subdirectories) with its raw, gzipped,
 * and Brotli-compressed size, so
 * a data / proto change can be size-justified (before vs after).
 *
 * Run `pnpm build:data-proto` first to (re)generate the assets, then:
 *   node scripts/data-asset-sizes.ts                   # print a table
 *   node scripts/data-asset-sizes.ts --json            # machine-readable JSON
 *   node scripts/data-asset-sizes.ts --save foo        # also write a snapshot to
 *                                                       # scripts/.size-snapshots/foo.json
 *   node scripts/data-asset-sizes.ts --diff foo        # compare current vs a saved snapshot
 *   node scripts/data-asset-sizes.ts --check-description-budgets
 *                                                       # verify 13 shard assets within limits
 */

import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(repoRoot, "apps/web/src/assets/data");
const SNAPSHOT_DIR = join(repoRoot, "scripts/.size-snapshots");

export interface AssetSize {
  id: string;
  raw: number;
  gzip: number;
  brotli: number;
}

export function collect(): AssetSize[] {
  if (!existsSync(DATA_DIR)) {
    throw new Error(`No data dir at ${DATA_DIR}. Run \`pnpm build:data-proto\` first.`);
  }
  const files = readdirSync(DATA_DIR, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isFile() && entry.name.endsWith(".pb")) return [entry.name];
      if (!entry.isDirectory()) return [];
      return readdirSync(join(DATA_DIR, entry.name))
        .filter((file) => file.endsWith(".pb"))
        .map((file) => `${entry.name}/${file}`);
    })
    .sort();
  return files.map((id) => {
    const bytes = readFileSync(join(DATA_DIR, id));
    return {
      id,
      raw: bytes.byteLength,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
      brotli: brotliCompressSync(bytes, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).byteLength,
    };
  });
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function printTable(sizes: AssetSize[]): void {
  const byBrotli = [...sizes].sort((a, b) => b.brotli - a.brotli);
  const idW = Math.max(...sizes.map((s) => s.id.length), 5);
  console.log(
    `${"asset".padEnd(idW)}  ${"raw".padStart(12)}  ${"gzip".padStart(12)}  ${"brotli".padStart(12)}`,
  );
  console.log("-".repeat(idW + 42));
  for (const s of byBrotli) {
    console.log(
      `${s.id.padEnd(idW)}  ${fmt(s.raw).padStart(12)}  ${fmt(s.gzip).padStart(12)}  ${fmt(s.brotli).padStart(12)}`,
    );
  }
  const totalRaw = sizes.reduce((a, s) => a + s.raw, 0);
  const totalGzip = sizes.reduce((a, s) => a + s.gzip, 0);
  const totalBrotli = sizes.reduce((a, s) => a + s.brotli, 0);
  console.log("-".repeat(idW + 42));
  console.log(
    `${"TOTAL".padEnd(idW)}  ${fmt(totalRaw).padStart(12)}  ${fmt(totalGzip).padStart(12)}  ${fmt(totalBrotli).padStart(12)}`,
  );
}

function loadSnapshot(name: string): AssetSize[] {
  const p = join(SNAPSHOT_DIR, `${name}.json`);
  if (!existsSync(p)) throw new Error(`No snapshot at ${p}`);
  const raw = JSON.parse(readFileSync(p, "utf8")) as Array<{
    id: string;
    raw: number;
    gzip: number;
    brotli?: number;
  }>;
  // Backward-compatible: old snapshots lack `brotli`; treat missing as 0.
  return raw.map((s) => ({ id: s.id, raw: s.raw, gzip: s.gzip, brotli: s.brotli ?? 0 }));
}

function printDiff(current: AssetSize[], base: AssetSize[]): void {
  const baseById = new Map(base.map((s) => [s.id, s]));
  const curById = new Map(current.map((s) => [s.id, s]));
  const ids = [...new Set([...baseById.keys(), ...curById.keys()])].sort();
  const idW = Math.max(...ids.map((s) => s.length), 5);
  console.log(
    `${"asset".padEnd(idW)}  ${"brotli Δ".padStart(14)}  ${"brotli now".padStart(12)}  ${"gzip Δ".padStart(14)}  ${"gzip now".padStart(12)}`,
  );
  console.log("-".repeat(idW + 58));
  let deltaBrotliTotal = 0;
  let deltaGzipTotal = 0;
  for (const id of ids) {
    const b = baseById.get(id);
    const c = curById.get(id);
    const bBrotli = b?.brotli ?? 0;
    const cBrotli = c?.brotli ?? 0;
    const dBrotli = cBrotli - bBrotli;
    deltaBrotliTotal += dBrotli;
    const bGzip = b?.gzip ?? 0;
    const cGzip = c?.gzip ?? 0;
    const dGzip = cGzip - bGzip;
    deltaGzipTotal += dGzip;
    const signBrotli = dBrotli > 0 ? "+" : "";
    const signGzip = dGzip > 0 ? "+" : "";
    console.log(
      `${id.padEnd(idW)}  ${`${signBrotli}${fmt(dBrotli)}`.padStart(14)}  ${fmt(cBrotli).padStart(12)}  ${`${signGzip}${fmt(dGzip)}`.padStart(14)}  ${fmt(cGzip).padStart(12)}`,
    );
  }
  console.log("-".repeat(idW + 58));
  const signBrotli = deltaBrotliTotal > 0 ? "+" : "";
  const signGzip = deltaGzipTotal > 0 ? "+" : "";
  console.log(
    `${"TOTAL Δ".padEnd(idW)}  ${`${signBrotli}${fmt(deltaBrotliTotal)}`.padStart(14)}  ${"".padStart(12)}  ${`${signGzip}${fmt(deltaGzipTotal)}`.padStart(14)}`,
  );
}

/**
 * Check that exactly 13 `catalogue.descriptions.*.pb` assets exist and that
 * their sizes are within inclusive limits. Returns a list of error strings;
 * an empty list means all checks passed.
 *
 * Limits:
 *   - Exactly 13 shard files
 *   - Total Brotli  ≤ 1,000,000 bytes
 *   - Each  Brotli  ≤   200,000 bytes
 *   - Total raw     ≤ 5,000,000 bytes
 *   - Each  raw     ≤ 1,000,000 bytes
 */
export function checkDescriptionBudgets(sizes: AssetSize[]): string[] {
  const shards = sizes.filter((s) => /(^|\/)catalogue\.descriptions\..+\.pb$/.test(s.id));
  const errors: string[] = [];

  const EXPECTED_COUNT = 13;
  if (shards.length !== EXPECTED_COUNT) {
    errors.push(
      `Expected ${EXPECTED_COUNT} catalogue.descriptions.*.pb assets, found ${shards.length.toLocaleString("en-US")}`,
    );
  }

  const TOTAL_BROTLI_LIMIT = 1_000_000;
  const totalBrotli = shards.reduce((a, s) => a + s.brotli, 0);
  if (totalBrotli > TOTAL_BROTLI_LIMIT) {
    errors.push(
      `Total Brotli ${totalBrotli.toLocaleString("en-US")} bytes exceeds limit of ${TOTAL_BROTLI_LIMIT.toLocaleString("en-US")} bytes`,
    );
  }

  const PER_SHARD_BROTLI_LIMIT = 200_000;
  for (const s of shards) {
    if (s.brotli > PER_SHARD_BROTLI_LIMIT) {
      errors.push(
        `${s.id}: Brotli ${s.brotli.toLocaleString("en-US")} bytes exceeds limit of ${PER_SHARD_BROTLI_LIMIT.toLocaleString("en-US")} bytes`,
      );
    }
  }

  const TOTAL_RAW_LIMIT = 5_000_000;
  const totalRaw = shards.reduce((a, s) => a + s.raw, 0);
  if (totalRaw > TOTAL_RAW_LIMIT) {
    errors.push(
      `Total raw ${totalRaw.toLocaleString("en-US")} bytes exceeds limit of ${TOTAL_RAW_LIMIT.toLocaleString("en-US")} bytes`,
    );
  }

  const PER_SHARD_RAW_LIMIT = 1_000_000;
  for (const s of shards) {
    if (s.raw > PER_SHARD_RAW_LIMIT) {
      errors.push(
        `${s.id}: raw ${s.raw.toLocaleString("en-US")} bytes exceeds limit of ${PER_SHARD_RAW_LIMIT.toLocaleString("en-US")} bytes`,
      );
    }
  }

  return errors;
}

function main(): void {
  const args = process.argv.slice(2);
  const sizes = collect();

  if (args.includes("--check-description-budgets")) {
    const errors = checkDescriptionBudgets(sizes);
    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`  ✗ ${err}`);
      }
      process.exit(1);
    }
    const shards = sizes.filter((s) => /^catalogue\.descriptions\..+\.pb$/.test(s.id));
    const totalRaw = shards.reduce((a, s) => a + s.raw, 0);
    const totalBrotli = shards.reduce((a, s) => a + s.brotli, 0);
    const maxBrotli = shards.reduce((a, s) => Math.max(a, s.brotli), 0);
    console.log(
      `✓ 13 description shards: total raw ${fmt(totalRaw)} B, total Brotli ${fmt(totalBrotli)} B, max shard Brotli ${fmt(maxBrotli)} B`,
    );
    return;
  }

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

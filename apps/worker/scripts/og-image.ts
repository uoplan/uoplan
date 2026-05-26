#!/usr/bin/env node
/**
 * Local OG image test script.
 * Usage: pnpm og-image <base64url_state>
 *
 * Reads .pb data files from apps/web/public/data/, runs the same pipeline as
 * the worker's /api/og-image/:state endpoint, and writes playground/og-image.png.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  DataProto,
  buildDataCache,
  decodeStateFromBase64,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoIndices,
  fromProtoSchedulesData,
  peekTermAndYearFromBase64,
} from "@uoplan/schedule";
import {
  buildColorMap,
  reconstructScheduleForPreview,
  renderCalendarToSvg,
  scheduleToEvents,
} from "@uoplan/calendar";

const __dirname = dirname(fileURLToPath(import.meta.url));
// WORKER_ROOT is injected by esbuild at build time (see og-image-runner.mjs)
declare const WORKER_ROOT: string | undefined;
const _workerRoot: string =
  typeof WORKER_ROOT !== "undefined" ? WORKER_ROOT : join(__dirname, "..");
const ROOT = join(_workerRoot, "../..");
const DATA_DIR = join(ROOT, "apps/web/public/data");

function base64urlToBase64(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return padded + "=".repeat(pad);
}

function readData(filename: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(join(DATA_DIR, filename)));
  } catch {
    return null;
  }
}

function fallbackSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111113"/>
  <text x="600" y="315" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="48" font-weight="700" fill="#ffffff">uoplan</text>
  <text x="600" y="375" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="20" fill="#909296">Course Schedule Planner</text>
</svg>`;
}

async function run() {
  const stateBase64url = process.argv.slice(2).find((a) => a !== "--");
  if (!stateBase64url) {
    console.error("Usage: pnpm og-image <base64url_state>");
    process.exit(1);
  }

  // Load WASM from the worker's node_modules (path resolved at build time)
  const wasmPath = join(_workerRoot, "node_modules/@resvg/resvg-wasm/index_bg.wasm");
  const wasmBytes = readFileSync(wasmPath);
  await initWasm(wasmBytes);

  const fontRegular = readFileSync(join(ROOT, "apps/web/public/fonts/dm-mono-regular.ttf"));
  const fontBold = readFileSync(join(ROOT, "apps/web/public/fonts/dm-mono-bold.ttf"));

  let svg: string;

  const base64 = base64urlToBase64(stateBase64url);

  const peek = peekTermAndYearFromBase64(base64);
  if (!peek) {
    console.warn("Could not peek term/year from state — using fallback");
    svg = fallbackSvg();
  } else {
    const manifestBytes = readData("catalogue.pb");
    const indicesBytes = readData("indices.pb");

    if (!manifestBytes || !indicesBytes) {
      console.error("Missing catalogue.pb or indices.pb in", DATA_DIR);
      process.exit(1);
    }

    const manifest = fromProtoCatalogueManifest(DataProto.CatalogueManifest.decode(manifestBytes));
    const yearForCatalogue = peek.firstYear
      ? (manifest.years.find((y) => y >= peek.firstYear!) ?? manifest.years[0])
      : manifest.years[0];

    if (!yearForCatalogue) {
      console.error("No matching catalogue year for firstYear:", peek.firstYear);
      process.exit(1);
    }

    const termId = peek.termId;
    if (!termId) {
      console.error("No termId in state");
      process.exit(1);
    }

    const catalogueBytes = readData(`catalogue.${yearForCatalogue}.pb`);
    const schedulesBytes = readData(`schedules.${termId}.pb`);

    if (!catalogueBytes || !schedulesBytes) {
      console.error(
        `Missing catalogue.${yearForCatalogue}.pb or schedules.${termId}.pb in ${DATA_DIR}`,
      );
      process.exit(1);
    }

    const catalogue = fromProtoCatalogue(DataProto.Catalogue.decode(catalogueBytes));
    const schedulesData = fromProtoSchedulesData(DataProto.SchedulesData.decode(schedulesBytes));
    const indices = fromProtoIndices(DataProto.Indices.decode(indicesBytes));
    const cache = buildDataCache(catalogue, schedulesData);

    const decoded = decodeStateFromBase64(base64, catalogue, indices);
    if ("error" in decoded) {
      console.error("Failed to decode state:", decoded.error);
      process.exit(1);
    }

    const constraints = {
      minStartMinutes: decoded.generationMinStartMinutes,
      maxEndMinutes: decoded.generationMaxEndMinutes,
      allowedDays: decoded.generationAllowedDays,
      compressedSchedule: decoded.generationCompressedSchedule,
    };

    const schedule = reconstructScheduleForPreview(decoded, cache, constraints);
    if (!schedule || schedule.enrollments.length === 0) {
      console.warn("No schedule reconstructed — using fallback");
      svg = fallbackSvg();
    } else {
      const events = scheduleToEvents(schedule, null);
      const colorMap = buildColorMap(schedule, {});
      svg = renderCalendarToSvg(events, colorMap);
    }
  }

  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [new Uint8Array(fontRegular), new Uint8Array(fontBold)],
      loadSystemFonts: false,
    },
    fitTo: { mode: "original" },
  });
  const png = resvg.render().asPng();

  mkdirSync(join(ROOT, "playground"), { recursive: true });
  const outPath = join(ROOT, "playground/og-image.png");
  writeFileSync(outPath, png);
  console.log(`Written to ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Local OG image test script.
 * Usage: pnpm og-image <base64url_schedule_payload>
 *
 * The argument is the `p` payload embedded in a share URL — a base64url-encoded
 * `SchedulePreview` (index-based courses + sections + term), the same value the
 * web app appends in `getShareUrl()`. This script reads .pb data files from
 * apps/web/src/assets/data/, runs the same fast-path pipeline as the worker's
 * /api/og-image endpoint (no schedule generation), and writes
 * playground/og-image.png.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  DataProto,
  enrichSchedulesDataWithGrades,
  fromProtoCourseGradesData,
  fromProtoSchedulesData,
  getGradeLookups,
  reconstructScheduleFromPreview,
} from "@uoplan/core";
import { SchedulePreview } from "@uoplan/proto/state";
import { renderCalendarToSvg, scheduleToEvents } from "@uoplan/calendar";

const __dirname = dirname(fileURLToPath(import.meta.url));
// WORKER_ROOT is injected by esbuild at build time (see og-image-runner.mjs)
declare const WORKER_ROOT: string | undefined;
const _workerRoot: string =
  typeof WORKER_ROOT !== "undefined" ? WORKER_ROOT : join(__dirname, "..");
const ROOT = join(_workerRoot, "../..");
const DATA_DIR = join(ROOT, "apps/web/src/assets/data");

function base64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return new Uint8Array(Buffer.from(padded + "=".repeat(pad), "base64"));
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
  const payloadBase64url = process.argv.slice(2).find((a) => a !== "--");
  if (!payloadBase64url) {
    console.error("Usage: pnpm og-image <base64url_schedule_payload>");
    process.exit(1);
  }

  // Load WASM from the worker's node_modules (path resolved at build time)
  const wasmPath = join(_workerRoot, "node_modules/@resvg/resvg-wasm/index_bg.wasm");
  const wasmBytes = readFileSync(wasmPath);
  await initWasm(wasmBytes);

  const fontRegular = readFileSync(join(ROOT, "apps/web/public/fonts/dm-mono-regular.ttf"));
  const fontBold = readFileSync(join(ROOT, "apps/web/public/fonts/dm-mono-bold.ttf"));

  let svg: string;

  const payload = SchedulePreview.decode(base64urlToBytes(payloadBase64url));
  const termId = String(payload.termId);
  console.log("[og-image] termId:", termId, "courses:", payload.courses.length);

  const schedulesBytes = readData(`schedules.${termId}.pb`);
  if (!schedulesBytes || payload.courses.length === 0) {
    console.warn("[og-image] Missing schedules data or empty payload — using fallback");
    svg = fallbackSvg();
  } else {
    const rawSchedules = fromProtoSchedulesData(DataProto.SchedulesData.decode(schedulesBytes));
    const gradesBytes = readData("grades.pb");
    const grades = gradesBytes
      ? fromProtoCourseGradesData(DataProto.GradesData.decode(gradesBytes))
      : null;
    const schedulesData = grades
      ? enrichSchedulesDataWithGrades(rawSchedules, getGradeLookups(grades), Number(termId))
      : rawSchedules;

    const reconstructed = reconstructScheduleFromPreview(payload, schedulesData);
    if (!reconstructed || reconstructed.schedule.enrollments.length === 0) {
      console.warn("[og-image] No schedule reconstructed — using fallback");
      svg = fallbackSvg();
    } else {
      const events = scheduleToEvents(reconstructed.schedule, null);
      svg = renderCalendarToSvg(events, reconstructed.colorMap);
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

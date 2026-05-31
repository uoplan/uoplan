import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  buildDataCache,
  decodeStateFromBase64,
  enrichSchedulesDataWithGrades,
  getGradeLookups,
  getMergedCatalogue,
  peekTermAndYearFromBase64,
  reconstructScheduleForPreview,
} from "@uoplan/core";
import {
  loadCatalogue,
  loadCatalogueManifest,
  loadGrades,
  loadIndices,
  loadSchedules,
  optional,
} from "@uoplan/data";
import { createAssetsTransport } from "@uoplan/data/worker";
import { renderCalendarToSvg, scheduleToEvents } from "@uoplan/calendar";
import type { Env } from "./index.js";

// @ts-ignore - wrangler handles .wasm imports as WebAssembly.Module
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

let wasmInitialized = false;

async function ensureWasm() {
  if (wasmInitialized) return;
  await initWasm(resvgWasm as WebAssembly.Module);
  wasmInitialized = true;
}

function base64urlToBase64(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return padded + "=".repeat(pad);
}

function fallbackSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111113"/>
  <text x="600" y="315" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="48" font-weight="700" fill="#ffffff">uoplan</text>
  <text x="600" y="375" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="20" fill="#909296">Course Schedule Planner</text>
</svg>`;
}

async function svgToPng(svg: string, fontBuffers?: Uint8Array[]): Promise<Uint8Array> {
  await ensureWasm();
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      ...(fontBuffers?.length ? { fontBuffers } : {}),
    },
    fitTo: { mode: "original" },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

// Workers expose caches.default which is not in the standard CacheStorage type
const defaultCache = (caches as unknown as { default: Cache }).default;

export async function handleOgImage(
  stateBase64url: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const cacheKey = new Request(`https://og-cache.internal/v1/${stateBase64url}`);

  const cached = await defaultCache.match(cacheKey);
  if (cached) return cached;

  const png = await generatePng(stateBase64url, env, origin);

  const response = new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });

  await defaultCache.put(cacheKey, response.clone());
  return response;
}

async function generatePng(stateBase64url: string, env: Env, origin: string): Promise<Uint8Array> {
  const base64 = base64urlToBase64(stateBase64url);
  const transport = createAssetsTransport(env.ASSETS, origin);
  const [fontRegular, fontBold] = await Promise.all([
    optional(transport, "/fonts/dm-mono-regular.ttf"),
    optional(transport, "/fonts/dm-mono-bold.ttf"),
  ]);
  const fonts = [fontRegular, fontBold].filter(Boolean) as Uint8Array[];
  const fallback = () => svgToPng(fallbackSvg(), fonts);

  try {
    const peek = peekTermAndYearFromBase64(base64);
    if (!peek) {
      return fallback();
    }
    const termId = peek.termId;
    if (!termId) {
      return fallback();
    }

    const manifest = await loadCatalogueManifest(transport);
    const yearForCatalogue = peek.firstYear
      ? (manifest.years.find((y) => y <= peek.firstYear!) ??
        manifest.years[manifest.years.length - 1])
      : manifest.years[0];
    const latestYear = manifest.years[0];
    if (!yearForCatalogue || latestYear === undefined) {
      return fallback();
    }

    const [latestCatalogue, yearCatalogueObj, rawSchedules, indices, grades] = await Promise.all([
      loadCatalogue(transport, latestYear),
      yearForCatalogue !== latestYear
        ? loadCatalogue(transport, yearForCatalogue)
        : Promise.resolve(null),
      loadSchedules(transport, termId),
      loadIndices(transport),
      loadGrades(transport).catch(() => null),
    ]);

    // Grade distributions are no longer embedded in schedules.NNNN.pb, so
    // reconstruct them from grades.pb. This keeps both the "prefer easier"
    // difficulty index used by reconstruction AND the grade bars rendered on
    // the OG image correct. Grades are optional: a failure degrades gracefully.
    const schedulesData = grades
      ? enrichSchedulesDataWithGrades(rawSchedules, getGradeLookups(grades), Number(termId))
      : rawSchedules;

    const catalogueForDecode = getMergedCatalogue(
      latestCatalogue,
      yearCatalogueObj?.courses ?? null,
      [],
    );
    const decodedForCompleted = decodeStateFromBase64(base64, catalogueForDecode, indices);
    const completedCourses =
      "error" in decodedForCompleted ? [] : decodedForCompleted.completedCourseCodes;
    const catalogue = getMergedCatalogue(
      latestCatalogue,
      yearCatalogueObj?.courses ?? null,
      completedCourses,
    );

    const cache = buildDataCache(catalogue, schedulesData);

    const decoded = decodeStateFromBase64(base64, catalogue, indices);
    if ("error" in decoded) {
      return fallback();
    }

    const constraints = {
      minStartMinutes: decoded.generationMinStartMinutes,
      maxEndMinutes: decoded.generationMaxEndMinutes,
      compressedSchedule: decoded.generationCompressedSchedule,
      blockedTimes: decoded.blockedTimes,
    };

    const reconstructed = reconstructScheduleForPreview(decoded, cache, constraints);
    if (!reconstructed || reconstructed.schedule.enrollments.length === 0) {
      return fallback();
    }

    const events = scheduleToEvents(reconstructed.schedule, null);
    const svg = renderCalendarToSvg(events, reconstructed.colorMap);

    return svgToPng(svg, fonts);
  } catch (err) {
    console.error("[og-image] unexpected error:", err);
    return fallback();
  }
}

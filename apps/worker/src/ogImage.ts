import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  DataProto,
  buildDataCache,
  decodeStateFromBase64,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoIndices,
  fromProtoSchedulesData,
  getMergedCatalogue,
  peekTermAndYearFromBase64,
} from "@uoplan/schedule";
import {
  buildColorMap,
  reconstructScheduleForPreview,
  renderCalendarToSvg,
  scheduleToEvents,
} from "@uoplan/calendar";
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

async function fetchBytes(env: Env, origin: string, path: string): Promise<Uint8Array | null> {
  try {
    const res = await env.ASSETS.fetch(new Request(`${origin}${path}`));
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
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
  const [fontRegular, fontBold] = await Promise.all([
    fetchBytes(env, origin, "/fonts/dm-mono-regular.ttf"),
    fetchBytes(env, origin, "/fonts/dm-mono-bold.ttf"),
  ]);
  const fonts = [fontRegular, fontBold].filter(Boolean) as Uint8Array[];
  const fallback = () => svgToPng(fallbackSvg(), fonts);

  try {
    const peek = peekTermAndYearFromBase64(base64);
    if (!peek) {
      return fallback();
    }

    const [manifestBytes, indicesBytes] = await Promise.all([
      fetchBytes(env, origin, "/data/catalogue.pb"),
      fetchBytes(env, origin, "/data/indices.pb"),
    ]);

    if (!manifestBytes || !indicesBytes) {
      return fallback();
    }

    const manifest = fromProtoCatalogueManifest(DataProto.CatalogueManifest.decode(manifestBytes));
    const yearForCatalogue = peek.firstYear
      ? (manifest.years.find((y) => y <= peek.firstYear!) ??
        manifest.years[manifest.years.length - 1])
      : manifest.years[0];

    if (!yearForCatalogue) {
      return fallback();
    }

    const termId = peek.termId;
    if (!termId) {
      return fallback();
    }

    const latestYear = manifest.years[0]!;
    const [latestCatalogueBytes, yearCatalogueBytes, schedulesBytes] = await Promise.all([
      fetchBytes(env, origin, `/data/catalogue.${latestYear}.pb`),
      yearForCatalogue !== latestYear
        ? fetchBytes(env, origin, `/data/catalogue.${yearForCatalogue}.pb`)
        : Promise.resolve(null),
      fetchBytes(env, origin, `/data/schedules.${termId}.pb`),
    ]);

    if (!latestCatalogueBytes || !schedulesBytes) {
      return fallback();
    }

    const latestCatalogue = fromProtoCatalogue(DataProto.Catalogue.decode(latestCatalogueBytes));
    const yearCatalogueObj = yearCatalogueBytes
      ? fromProtoCatalogue(DataProto.Catalogue.decode(yearCatalogueBytes))
      : null;
    const indices = fromProtoIndices(DataProto.Indices.decode(indicesBytes));

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

    const schedulesData = fromProtoSchedulesData(DataProto.SchedulesData.decode(schedulesBytes));
    const cache = buildDataCache(catalogue, schedulesData);

    const decoded = decodeStateFromBase64(base64, catalogue, indices);
    if ("error" in decoded) {
      return fallback();
    }

    const constraints = {
      minStartMinutes: decoded.generationMinStartMinutes,
      maxEndMinutes: decoded.generationMaxEndMinutes,
      allowedDays: decoded.generationAllowedDays,
      compressedSchedule: decoded.generationCompressedSchedule,
    };

    const schedule = reconstructScheduleForPreview(decoded, cache, constraints);
    if (!schedule || schedule.enrollments.length === 0) {
      return fallback();
    }

    const events = scheduleToEvents(schedule, null);
    const colorMap = buildColorMap(schedule);
    const svg = renderCalendarToSvg(events, colorMap);

    return svgToPng(svg, fonts);
  } catch (err) {
    console.error("[og-image] unexpected error:", err);
    return fallback();
  }
}

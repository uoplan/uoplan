import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  enrichSchedulesDataWithGrades,
  getGradeLookups,
  reconstructScheduleFromPreview,
} from "@uoplan/core";
import { SchedulePreview } from "@uoplan/proto/state";
import { loadGrades, loadSchedules, optional } from "@uoplan/data";
import { createAssetsTransport } from "@uoplan/data/worker";
import { renderSchedulePreviewToSvg } from "@uoplan/calendar";
import type { Env } from "./index.js";

// @ts-ignore - wrangler handles .wasm imports as WebAssembly.Module
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

let wasmInitialized = false;

async function ensureWasm() {
  if (wasmInitialized) return;
  await initWasm(resvgWasm as WebAssembly.Module);
  wasmInitialized = true;
}

function base64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  schedulePayload: string | undefined,
  env: Env,
  origin: string,
): Promise<Response> {
  const cacheId = schedulePayload ?? `nopayload/${stateBase64url}`;
  const cacheKey = new Request(`https://og-cache.internal/v2/${cacheId}`);

  const cached = await defaultCache.match(cacheKey);
  if (cached) return cached;

  const png = await generatePng(schedulePayload, env, origin);

  const response = new Response(png.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });

  await defaultCache.put(cacheKey, response.clone());
  return response;
}

async function generatePng(
  schedulePayload: string | undefined,
  env: Env,
  origin: string,
): Promise<Uint8Array> {
  const transport = createAssetsTransport(env.ASSETS, origin);
  const [fontRegular, fontBold] = await Promise.all([
    optional(transport, "/fonts/dm-mono-regular.ttf"),
    optional(transport, "/fonts/dm-mono-bold.ttf"),
  ]);
  const fonts = [fontRegular, fontBold].filter(Boolean) as Uint8Array[];
  const fallback = () => svgToPng(fallbackSvg(), fonts);

  if (!schedulePayload) return fallback();

  try {
    const preview = SchedulePreview.decode(base64urlToBytes(schedulePayload));
    const termId = String(preview.termId);
    if (!termId || preview.courses.length === 0) {
      return fallback();
    }

    const [rawSchedules, grades] = await Promise.all([
      loadSchedules(transport, termId),
      loadGrades(transport).catch(() => null),
    ]);

    const schedulesData = grades
      ? enrichSchedulesDataWithGrades(rawSchedules, getGradeLookups(grades), Number(termId))
      : rawSchedules;

    const reconstructed = reconstructScheduleFromPreview(preview, schedulesData);
    if (!reconstructed || reconstructed.schedule.enrollments.length === 0) {
      return fallback();
    }

    return svgToPng(
      renderSchedulePreviewToSvg(reconstructed.schedule, reconstructed.colorMap),
      fonts,
    );
  } catch (err) {
    console.error("[og-image] unexpected error:", err);
    return fallback();
  }
}

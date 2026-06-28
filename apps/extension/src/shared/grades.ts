import browser from "webextension-polyfill";
import { GradesData } from "@uoplan/proto/data";
import { fromProtoCourseGradesData } from "@uoplan/core/dataTypes/grades";
import type { CourseGradesData } from "@uoplan/core/dataTypes/grades";
import { getGradeLookups } from "@uoplan/core/gradeLookup";
import type { GradeLookups } from "@uoplan/core/gradeLookup";
import { createManifestTransport } from "@uoplan/data/browser";
import { DATA_MANIFEST_PATH } from "@uoplan/data/transport";
import type { FetchBytes, ResolveUrl } from "@uoplan/data/transport";
import { DEV_DATA_BASE_URL, PROD_DATA_BASE_URL } from "./config";

/**
 * Background-side uoPlan grade-data loader (Phase 1 stub).
 *
 * Fetches `manifest.json` + `grades.pb` from the uoPlan data origin, decodes via
 * the shared `@uoplan/{proto,core,data}` packages, and builds the per-course
 * grade lookup tables. Fetching MUST happen here (the background service worker)
 * because it holds the cross-origin `host_permissions` — content scripts are
 * subject to page CORS.
 *
 * Dev reuses the running web dev server (`http://localhost:5173`), which serves
 * the same `/data/manifest.json` + `/data/<id>.pb` contract; prod hits
 * `https://uoplan.party`. The raw bytes are cached in `storage.local` with a TTL
 * so repeated loads don't re-download the multi-MB asset.
 *
 * The full grade-overlay UI is a later phase; this only proves the data pipeline.
 */

const GRADES_ASSET_ID = "grades.pb";
const CACHE_KEY = "uoplan:grades:cache";
const BASE_URL_PREF_KEY = "uoplan:dataBaseUrl";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const MAX_CACHE_BYTES = 6 * 1024 * 1024; // don't cache assets larger than ~6MB

export interface GradesSummary {
  baseUrl: string;
  fromCache: boolean;
  courseCount: number;
  sectionCount: number;
}

export interface LoadedGrades extends GradesSummary {
  data: CourseGradesData;
  lookups: GradeLookups;
}

interface BytesCacheEntry {
  baseUrl: string;
  fetchedAt: number;
  /** base64-encoded `grades.pb` bytes. */
  b64: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Candidate data origins, in priority order. A stored preference wins. */
async function resolveBaseUrls(): Promise<string[]> {
  const stored = (await browser.storage.local.get(BASE_URL_PREF_KEY)) as Record<string, unknown>;
  const override = stored[BASE_URL_PREF_KEY];
  if (typeof override === "string" && override) return [override];
  return [DEV_DATA_BASE_URL, PROD_DATA_BASE_URL];
}

/** Fetch the data manifest for `baseUrl` and build an id → URL resolver. */
async function fetchResolver(baseUrl: string): Promise<ResolveUrl> {
  const res = await fetch(`${baseUrl}${DATA_MANIFEST_PATH}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
  const manifest = (await res.json()) as Record<string, string>;
  return (id) => manifest[id];
}

function countSections(data: CourseGradesData): number {
  let n = 0;
  for (const course of data.courses) n += course.sections.length;
  return n;
}

function decode(bytes: Uint8Array): CourseGradesData {
  return fromProtoCourseGradesData(GradesData.decode(bytes));
}

async function readCache(): Promise<BytesCacheEntry | null> {
  try {
    const stored = (await browser.storage.local.get(CACHE_KEY)) as Record<string, unknown>;
    const entry = stored[CACHE_KEY] as BytesCacheEntry | undefined;
    if (!entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(entry: BytesCacheEntry): Promise<void> {
  try {
    await browser.storage.local.set({ [CACHE_KEY]: entry });
  } catch {
    // Quota or serialization failure: caching is best-effort.
  }
}

/**
 * Load + decode uoPlan grades, preferring a fresh `storage.local` cache. Tries
 * each candidate origin until one succeeds. Throws only if every origin fails.
 */
export async function loadGrades(options?: { force?: boolean }): Promise<LoadedGrades> {
  if (!options?.force) {
    const cached = await readCache();
    if (cached) {
      const data = decode(base64ToBytes(cached.b64));
      return {
        data,
        lookups: getGradeLookups(data),
        baseUrl: cached.baseUrl,
        fromCache: true,
        courseCount: data.courses.length,
        sectionCount: countSections(data),
      };
    }
  }

  const baseUrls = await resolveBaseUrls();
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    try {
      const resolver = await fetchResolver(baseUrl);
      const transport: FetchBytes = createManifestTransport(resolver, baseUrl);
      const bytes = await transport(GRADES_ASSET_ID);
      const data = decode(bytes);

      if (bytes.length <= MAX_CACHE_BYTES) {
        await writeCache({ baseUrl, fetchedAt: Date.now(), b64: bytesToBase64(bytes) });
      }

      return {
        data,
        lookups: getGradeLookups(data),
        baseUrl,
        fromCache: false,
        courseCount: data.courses.length,
        sectionCount: countSections(data),
      };
    } catch (err) {
      errors.push(`${baseUrl}: ${(err as Error).message}`);
    }
  }

  throw new Error(`Failed to load grades from any origin — ${errors.join("; ")}`);
}

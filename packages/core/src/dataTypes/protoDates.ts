/**
 * Pure date codecs shared between the build-time proto encoder
 * (`apps/scraper/src/proto/schedules.ts`) and the runtime proto decoder
 * (`packages/core/src/dataTypes/schedules.ts`). Kept dependency-free so the
 * scraper can import it directly at runtime via `@uoplan/core/dataTypes/protoDates`.
 *
 * Meeting dates are stored in the protobuf as a compact `YYYYMMDD` integer.
 */

/** `"2026-05-04"` → `20260504`; non-numeric input → `0`. */
export function dateStringToYyyymmdd(value: string): number {
  const compact = value.replaceAll("-", "");
  const parsed = Number.parseInt(compact, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `20260504` → `"2026-05-04"`. */
export function yyyymmddToDateString(value: number): string {
  const s = String(Math.trunc(value)).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

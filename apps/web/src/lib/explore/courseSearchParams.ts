import { normalizeCourseCode } from "schedule";

/** Compact course code for URL query (e.g. `CSI 2110` → `CSI2110`). */
export function courseNormToSearchParam(norm: string): string {
  return norm.replace(/\s+/g, "").toUpperCase();
}

/** Parse `course` search param back to normalized catalogue-style code, or null if invalid. */
export function parseCourseSearchParam(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{3,4})(\d{4}[A-Z]?)$/i);
  if (!m?.[1] || !m[2]) return null;
  return normalizeCourseCode(`${m[1]} ${m[2]}`);
}

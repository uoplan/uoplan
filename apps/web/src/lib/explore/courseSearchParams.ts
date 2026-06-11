import { normalizeCourseCode } from "@uoplan/core";
import type { NormalizedCourseCode } from "@uoplan/core";

/** Compact lowercase course code for URL path (e.g. `CSI 2110` → `csi2110`). */
export function courseNormToPathParam(norm: NormalizedCourseCode): string {
  return norm.replaceAll(/\s+/g, "").toLowerCase();
}

/** Parse course path param back to normalized catalogue-style code, or null if invalid. */
export function parseCoursePathParam(raw?: string): NormalizedCourseCode | null {
  if (!raw?.trim()) return null;
  const compact = raw.trim().toUpperCase().replaceAll(/\s+/g, "");
  const m = compact.match(/^([A-Z]{3,4})(\d{4}[A-Z]?)$/i);
  if (!m?.[1] || !m[2]) return null;
  return normalizeCourseCode(`${m[1]} ${m[2]}`);
}

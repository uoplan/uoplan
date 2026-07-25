import type { Course } from "../dataTypes";
import type { DataCache } from "../dataCache";
import type { NormalizedCourseCode } from "../brand";

/**
 * Normalize course code for consistent lookup.
 * Handles variations like "AMM 5101", "AMM5101", "amm 5101" -> "AMM 5101"
 */
export function normalizeCourseCode(code: string): NormalizedCourseCode {
  const match = code.match(/^([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)$/i);
  if (!match) return code.trim() as NormalizedCourseCode;
  return `${match[1].toUpperCase()} ${match[2]}` as NormalizedCourseCode;
}

/**
 * Check if a course is an honours project / research course.
 * These courses are handled specially - they satisfy requirements but
 * are not scheduled like regular courses.
 */
export function isHonoursProject(code: string, cache: DataCache | null): boolean {
  if (!cache) return false;
  const course = cache.getCourse(code);
  return course?.code.endsWith("900") ?? false;
}

/**
 * Whether a course cannot be placed on a timetable: it is an honours/research
 * project (the legacy `endsWith("900")` rule, kept so those courses stay
 * timeless even when the registrar lists a stray orientation time), OR it has a
 * schedule entry whose sections (across every component) carry no real meeting
 * time. Such courses — honours theses, STG placements, co-op/work terms,
 * research or seminar requirements — satisfy a requirement without occupying a
 * timetable slot, so the generator emits a single empty ("timeless") combo.
 *
 * This mirrors the Rust engine's `DataView::is_timeless_course` and is a strict
 * superset of the old `isHonoursProject` override on the scheduling path (it
 * additionally covers the many no-time placements/theses/co-op courses that do
 * not end in 900). {@link isHonoursProject} is retained on its own for
 * implicit-honours inference, a distinct concern from schedulability.
 */
export function isTimelessCourse(code: string, cache: DataCache | null): boolean {
  if (!cache) return false;
  if (isHonoursProject(code, cache)) return true;
  const schedule = cache.getSchedule(code);
  if (!schedule) return false;
  return !Object.values(schedule.components).some((sections) =>
    sections.some(
      (section) =>
        Array.isArray(section.times) && section.times.some((t) => t.startMinutes < t.endMinutes),
    ),
  );
}

/**
 * Check if a course is a work term / stage course.
 * These are typically excluded from scheduling.
 */
export function isWorkTermCourse(course: Course): boolean {
  const component = course.component?.trim().toLowerCase() ?? "";
  return component.includes("work term");
}

/**
 * Get the credits for a course, defaulting to the provided school fallback if not found.
 */
export function getCourseCredits(
  code: string,
  cache: DataCache | null,
  defaultCredits = 3,
): number {
  if (!cache) return defaultCredits;
  return cache.getCourse(code)?.credits ?? defaultCredits;
}

/**
 * Get total credits for a list of course codes.
 */
export function getTotalCredits(codes: string[], cache: DataCache | null): number {
  if (!cache) return 0;
  return codes.reduce((sum, code) => sum + getCourseCredits(code, cache), 0);
}

/**
 * Parse a course code into its discipline and number parts.
 * e.g., "CSI 2101" -> { discipline: "CSI", number: "2101" }
 */
export function parseCourseCode(code: string): {
  discipline: string;
  number: string;
} | null {
  const match = code.match(/^([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)$/i);
  if (!match) return null;
  return {
    discipline: match[1].toUpperCase(),
    number: match[2],
  };
}

/**
 * Discipline (subject) prefix of a course code via whitespace split, uppercased.
 * Returns "" when the code is empty. Unlike {@link parseCourseCode}, this does
 * not validate the code shape — it simply takes the first whitespace-delimited
 * token (e.g. "CSI 2101" -> "CSI").
 */
export function getDiscipline(code: string): string {
  return code.split(/\s+/)[0]?.toUpperCase() ?? "";
}

/**
 * Get the level of a course (1000, 2000, 12000, etc.) from its code.
 * Parses the full course number and floors to the nearest thousand.
 */
export function getCourseLevel(code: string): number | null {
  const parsed = parseCourseCode(code);
  if (!parsed) return null;
  const num = parseInt(parsed.number, 10);
  if (Number.isNaN(num)) return null;
  return Math.floor(num / 1000) * 1000;
}

/** Discipline (subject) prefix of a course code, e.g. `PSY 1101` → `PSY`. */
export function disciplineOf(code: string): string | null {
  return parseCourseCode(code)?.discipline ?? null;
}

/** Course level bucket (1000, 2000, …) of a course code, or null. */
export function levelOf(code: string): number | null {
  return getCourseLevel(code);
}

/**
 * Return the language variant of a course code, or null if none exists.
 * English courses (hundreds digit 1–4) map to French (+ 400) and vice versa.
 * Bilingual/other courses (hundreds digit 0 or 9) have no variant.
 *
 * e.g. "CRM 1301" → "CRM 1701", "CRM 1701" → "CRM 1301", "ESP 1991" → null
 */
export function getLanguageVariant(
  normalizedCode: NormalizedCourseCode,
): NormalizedCourseCode | null {
  const parsed = parseCourseCode(normalizedCode);
  if (!parsed) return null;

  const numMatch = parsed.number.match(/^(\d{4})([A-Z]?)$/);
  if (!numMatch) return null;

  const n = parseInt(numMatch[1], 10);
  const suffix = numMatch[2];
  const hundreds = Math.floor(n / 100) % 10;

  if (hundreds >= 1 && hundreds <= 4) {
    return `${parsed.discipline} ${n + 400}${suffix}` as NormalizedCourseCode;
  }
  if (hundreds >= 5 && hundreds <= 8) {
    return `${parsed.discipline} ${n - 400}${suffix}` as NormalizedCourseCode;
  }
  return null;
}

/**
 * Check if a course code is an OPT transfer credit placeholder.
 * These are generated during transcript parsing for "OPT 1XXX" / "OPT 2XXX" etc.
 * e.g., "OPT 1000", "OPT 2001"
 */
export function isOptCourse(code: string): boolean {
  return /^OPT\s+\d{4}$/i.test(code.trim());
}

/**
 * The accompanying ("companion") FLS courses are taken alongside a content course
 * and are explicitly repeatable: a student may take e.g. FLS 2581 multiple times,
 * paired with different content courses, and each instance counts.
 * See {@link analyzeFrenchImmersionProgress} for the immersion-volume capping rules.
 */
const REPEATABLE_FLS_NUMBERS = new Set([2581, 3581, 4581, 4781]);

/**
 * Whether a course may legitimately be taken more than once for credit (i.e. the
 * same code can appear multiple times in a student's completed courses and each
 * instance counts toward requirements). Currently limited to the accompanying FLS
 * companion courses; later this can be driven by a catalogue `repeatable` flag.
 */
export function isRepeatableCourse(code: string): boolean {
  const parsed = parseCourseCode(normalizeCourseCode(code));
  if (!parsed || parsed.discipline !== "FLS") return false;
  const digits = parsed.number.replaceAll(/[^0-9]/g, "");
  const primary = parseInt(digits.slice(0, 4), 10);
  return !Number.isNaN(primary) && REPEATABLE_FLS_NUMBERS.has(primary);
}

/**
 * Check if a course is a non-degree mandatory course (e.g., ethics).
 * These courses are required for all uOttawa students but don't count
 * towards degree requirements and are not in the catalogue.
 * Currently includes:
 * - ITD 1100: Ethics in Engineering
 * - ITD 1500: Design and Ethics
 */
export function isNonDegreeCourse(code: string): boolean {
  const normalized = normalizeCourseCode(code);
  return normalized === "ITD 1100" || normalized === "ITD 1500";
}

/**
 * Format a course code with its title for display.
 * e.g., "CSI 2101" + "Discrete Structures" -> "CSI 2101 - Discrete Structures"
 */
export function formatCourseWithTitle(
  code: string,
  cache: DataCache | null,
  separator: string = " - ",
): string {
  const course = cache?.getCourse(code);
  const title = course?.title?.trim();
  if (!title) return code;
  return `${code}${separator}${title}`;
}

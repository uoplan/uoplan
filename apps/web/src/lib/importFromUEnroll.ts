import type { DataCache, GeneratedSchedule, SectionCombo } from "@uoplan/schedule";
import { normalizeCourseCode, getEnrollmentsForCourse } from "@uoplan/schedule";

export type ParsedUEnrollData = {
  termId: string | null;
  courses: Record<string, string[]>;
};

export type UEnrollResolveResult =
  | { ok: true; schedule: GeneratedSchedule; warnings: string[] }
  | { ok: false; reason: "no-courses" };

function extractRawParams(input: string): { data: string; term: string | null } {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    // Use raw search string to avoid URLSearchParams decoding + as space (breaks base64)
    const raw = url.search.slice(1);
    const dataMatch = raw.match(/(?:^|&)data=([^&]*)/);
    const termMatch = raw.match(/(?:^|&)term=([^&]*)/);
    return {
      data: dataMatch ? dataMatch[1] : trimmed,
      term: termMatch ? termMatch[1] : null,
    };
  } catch {
    return { data: trimmed, term: null };
  }
}

export function parseUEnrollUrl(input: string): ParsedUEnrollData {
  const { data, term } = extractRawParams(input);
  const json = JSON.parse(atob(decodeURIComponent(data)));
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("unexpected shape");
  }
  return { termId: term, courses: json as Record<string, string[]> };
}

export function resolveUEnrollSchedule(
  courses: Record<string, string[]>,
  cache: DataCache,
): UEnrollResolveResult {
  const warnings: string[] = [];
  const enrollments: GeneratedSchedule["enrollments"] = [];

  for (const [rawCode, sectionCodes] of Object.entries(courses)) {
    if (!Array.isArray(sectionCodes)) continue;

    const normalized = normalizeCourseCode(rawCode);
    const courseSchedule = cache.getSchedule(normalized);
    if (!courseSchedule) {
      warnings.push(normalized);
      continue;
    }

    const sectionCombo: SectionCombo = {};
    const remaining = new Set<string>(sectionCodes);

    for (const [component, sections] of Object.entries(courseSchedule.components)) {
      for (const section of sections) {
        const id = section.sectionCode ?? section.section;
        if (remaining.has(id)) {
          sectionCombo[component] = { section };
          remaining.delete(id);
          break;
        }
      }
    }

    if (Object.keys(sectionCombo).length === 0) {
      warnings.push(normalized);
      continue;
    }

    enrollments.push(getEnrollmentsForCourse(courseSchedule, sectionCombo));
  }

  if (enrollments.length === 0) {
    return { ok: false, reason: "no-courses" };
  }

  return { ok: true, schedule: { enrollments }, warnings };
}

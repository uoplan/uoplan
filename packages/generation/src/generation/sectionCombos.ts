import type { ComponentSection, CourseSchedule } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { isTimelessCourse, normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { timeSlotSatisfiesConstraints } from "./constraints";
import { timesOverlap } from "./overlaps";
import type { CourseEnrollment, GenerationConstraints, SectionCombo, TimeSlot } from "./types";

export function collectTimes(sections: ComponentSection[]): TimeSlot[] {
  const times: TimeSlot[] = [];
  for (const s of sections) {
    for (const t of s.times) {
      if (t.startMinutes < t.endMinutes) {
        times.push({
          day: t.day,
          startMinutes: t.startMinutes,
          endMinutes: t.endMinutes,
          meetingDates: t.meetingDates ?? null,
        });
      }
    }
  }
  return times;
}

export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  const result: T[][] = [];
  for (const item of first) {
    for (const combo of restProduct) {
      result.push([item, ...combo]);
    }
  }
  return result;
}

/** True if the section has at least one real time slot (used to skip TST/other components with empty times). */
export function sectionHasTimes(section: ComponentSection): boolean {
  return Array.isArray(section.times) && section.times.some((t) => t.startMinutes < t.endMinutes);
}

/**
 * True if any two time slots across the given sections overlap. Shared by the
 * lazy combo enumerator and the explore-page conflict preview so the
 * intra-combo clash rule has a single definition.
 */
export function sectionsHaveInternalOverlap(sections: ComponentSection[]): boolean {
  const times = collectTimes(sections);
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      if (timesOverlap(times[i], times[j])) return true;
    }
  }
  return false;
}

export function getValidSectionCombos(
  schedule: CourseSchedule,
  constraints?: GenerationConstraints,
): SectionCombo[] {
  const componentKeys = Object.keys(schedule.components).sort();
  const sectionArrays = componentKeys.map((key) => {
    const sections = schedule.components[key] ?? [];
    return sections.filter((section) => {
      if (!sectionHasTimes(section)) return false;
      if (!constraints) return true;

      const times = section.times
        .filter((t) => t.startMinutes < t.endMinutes)
        .map((t) => ({
          day: t.day,
          startMinutes: t.startMinutes,
          endMinutes: t.endMinutes,
          meetingDates: t.meetingDates ?? null,
        }));

      if (!times.every((t) => timeSlotSatisfiesConstraints(t, constraints))) {
        return false;
      }

      return true;
    });
  });

  if (sectionArrays.some((arr) => arr.length === 0)) {
    return [];
  }

  const allCombos = cartesianProduct(sectionArrays);
  const valid: SectionCombo[] = [];

  for (const combo of allCombos) {
    const sections = combo;
    const times = collectTimes(sections);
    let hasOverlap = false;
    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        if (timesOverlap(times[i], times[j])) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }
    if (!hasOverlap) {
      const obj: SectionCombo = {};
      for (const [idx, key] of componentKeys.entries()) {
        obj[key] = { section: sections[idx] };
      }
      valid.push(obj);
    }
  }

  return valid;
}

export function getEnrollmentsForCourse(
  schedule: CourseSchedule,
  sectionCombo: SectionCombo,
): CourseEnrollment {
  const sections = Object.values(sectionCombo).map((x) => x.section);
  const times = collectTimes(sections);
  return {
    courseCode: schedule.courseCode,
    sectionCombo,
    times,
  };
}

export function canonicalCourseCode(code: string, cache: DataCache): NormalizedCourseCode {
  const normalized = normalizeCourseCode(code);
  return cache.getCourse(normalized)?.code ?? normalized;
}

export function enrollmentForPicker(
  code: string,
  combo: SectionCombo,
  cache: DataCache,
): CourseEnrollment {
  if (isTimelessCourse(code, cache)) {
    return {
      courseCode: canonicalCourseCode(code, cache),
      sectionCombo: combo,
      times: [],
    };
  }
  const schedule = cache.getSchedule(code);
  if (!schedule) {
    return { courseCode: normalizeCourseCode(code), sectionCombo: combo, times: [] };
  }
  return getEnrollmentsForCourse(schedule, combo);
}

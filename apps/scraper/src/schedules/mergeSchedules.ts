import type { ComponentSection, CourseSchedule, MeetingTime } from "./parse.ts";

function timeKey(t: MeetingTime): string {
  return `${t.day}|${t.startMinutes}|${t.endMinutes}`;
}

function sectionKey(componentKey: string, section: ComponentSection): string {
  return `${componentKey}|${section.sectionCode ?? ""}|${section.section}`;
}

export function mergeVirtualIntoBase(
  base: CourseSchedule,
  virtualOnly: CourseSchedule,
): CourseSchedule {
  // base is treated as "non-virtual"; this function flips the relevant meeting-times to virtual.
  for (const [compKey, vSections] of Object.entries(virtualOnly.components)) {
    if (!base.components[compKey]) base.components[compKey] = [];
    const baseSections = base.components[compKey];

    const baseSectionByKey = new Map<string, ComponentSection>();
    baseSections.forEach((s) => baseSectionByKey.set(sectionKey(compKey, s), s));

    for (const vSection of vSections) {
      const key = sectionKey(compKey, vSection);
      const baseSection = baseSectionByKey.get(key);

      if (!baseSection) {
        // Extremely defensive: if a virtual section doesn't exist in the base result, keep it.
        baseSections.push(vSection);
        baseSectionByKey.set(key, vSection);
        continue;
      }

      const baseTimeByKey = new Map<string, number>();
      baseSection.times.forEach((t, idx) => baseTimeByKey.set(timeKey(t), idx));

      for (const vt of vSection.times) {
        const tKey = timeKey(vt);
        const baseTimeIdx = baseTimeByKey.get(tKey);
        if (baseTimeIdx != null) {
          baseSection.times[baseTimeIdx].virtual = true;
        } else {
          baseSection.times.push(vt);
          baseTimeByKey.set(tKey, baseSection.times.length - 1);
        }
      }
    }
  }

  return base;
}

/** Merge `src` course sections into `target` (same courseCode), deduping sections and times. */
function mergeCourseInto(target: CourseSchedule, src: CourseSchedule): void {
  if (!target.title && src.title) target.title = src.title;
  for (const [compKey, srcSections] of Object.entries(src.components)) {
    if (!target.components[compKey]) target.components[compKey] = [];
    const targetSections = target.components[compKey];
    const byKey = new Map<string, ComponentSection>();
    targetSections.forEach((s) => byKey.set(sectionKey(compKey, s), s));
    for (const srcSection of srcSections) {
      const key = sectionKey(compKey, srcSection);
      const existing = byKey.get(key);
      if (!existing) {
        targetSections.push(srcSection);
        byKey.set(key, srcSection);
        continue;
      }
      const timeKeys = new Set(existing.times.map(timeKey));
      for (const t of srcSection.times) {
        if (!timeKeys.has(timeKey(t))) {
          existing.times.push(t);
          timeKeys.add(timeKey(t));
        }
      }
    }
  }
}

/** Union a list of course schedules by course code, deduping sections/times. Preserves order. */
export function unionSchedulesByCourse(lists: CourseSchedule[][]): CourseSchedule[] {
  const byCode = new Map<string, CourseSchedule>();
  for (const list of lists) {
    for (const schedule of list) {
      const existing = byCode.get(schedule.courseCode);
      if (!existing) {
        byCode.set(schedule.courseCode, schedule);
      } else {
        mergeCourseInto(existing, schedule);
      }
    }
  }
  return Array.from(byCode.values());
}

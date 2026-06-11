import type { SchedulePreview } from "@uoplan/proto/state";
import type { NormalizedCourseCode } from "./brand";
import type { ComponentSection, CourseSchedule, SchedulesData } from "./dataTypes";
import { getEnrollmentsForCourse } from "./generation/sectionCombos";
import type { GeneratedSchedule, SectionCombo } from "./generation/types";
import type { ReconstructedPreview } from "./scheduleFromStateEngine";
import { buildColorMap } from "./utils/uiUtils";

/**
 * Index-based encoding of an already-generated schedule for the OG-image share
 * preview. Instead of course/section strings, selections are stored as indices
 * into the term's schedules dataset (`schedules.<termId>.pb`), which both the
 * web app and the OG worker load:
 *
 * - `courseIndex`        → index into {@link SchedulesData.schedules}
 * - `componentIndices[i]` → index into the course's component keys, sorted ascending
 * - `sectionIndices[i]`   → index into that component's sections array
 *
 * `componentIndices` and `sectionIndices` are parallel packed arrays (one
 * (component, section) pick per position), which keeps the payload minimal.
 *
 * The web app builds this via {@link buildSchedulePreview} when generating a
 * share URL; the worker reconstructs it via {@link reconstructScheduleFromPreview}
 * so it can render the exact schedule without re-running generation.
 */

function sortedComponentKeys(schedule: CourseSchedule): string[] {
  return Object.keys(schedule.components).sort();
}

function findSectionIndex(sections: ComponentSection[], section: ComponentSection): number {
  if (section.sectionCode != null) {
    const byCode = sections.findIndex((s) => s.sectionCode === section.sectionCode);
    if (byCode !== -1) return byCode;
  }
  return sections.findIndex((s) => s.section === section.section);
}

/**
 * Encodes a {@link GeneratedSchedule} into a {@link SchedulePreview} using
 * indices into `schedulesData`. Enrollments whose course or sections can't be
 * located in the dataset are skipped (e.g. honours projects with no schedule).
 */
export function buildSchedulePreview(
  schedule: GeneratedSchedule,
  schedulesData: SchedulesData,
  termId: number,
): SchedulePreview {
  const courseIndexByCode = new Map<NormalizedCourseCode, number>();
  schedulesData.schedules.forEach((s, i) => {
    courseIndexByCode.set(s.courseCode, i);
  });

  const courses: SchedulePreview["courses"] = [];
  for (const enrollment of schedule.enrollments) {
    const courseIndex = courseIndexByCode.get(enrollment.courseCode);
    if (courseIndex === undefined) continue;
    const courseSchedule = schedulesData.schedules[courseIndex];
    const keys = sortedComponentKeys(courseSchedule);

    const componentIndices: number[] = [];
    const sectionIndices: number[] = [];
    let complete = true;
    for (const [component, { section }] of Object.entries(enrollment.sectionCombo)) {
      const componentIndex = keys.indexOf(component);
      const arr = courseSchedule.components[component];
      const sectionIndex = arr ? findSectionIndex(arr, section) : -1;
      if (componentIndex === -1 || sectionIndex === -1) {
        complete = false;
        break;
      }
      componentIndices.push(componentIndex);
      sectionIndices.push(sectionIndex);
    }
    if (!complete || componentIndices.length === 0) continue;

    courses.push({ courseIndex, componentIndices, sectionIndices });
  }

  return { termId, courses };
}

/**
 * Reconstructs a {@link GeneratedSchedule} directly from a {@link SchedulePreview}
 * (index-based courses + sections) without running the schedule-generation
 * engine — the fast path used by the OG-image worker. Resolves each index
 * against `schedulesData`, assembles the {@link SectionCombo}s + meeting times,
 * and recomputes colours with {@link buildColorMap}.
 *
 * Returns `null` when no course resolves (e.g. the schedules data is for a
 * different term, or the dataset shifted since the link was created).
 */
export function reconstructScheduleFromPreview(
  preview: SchedulePreview,
  schedulesData: SchedulesData,
): ReconstructedPreview | null {
  const enrollments: GeneratedSchedule["enrollments"] = [];
  for (const course of preview.courses) {
    const courseSchedule = schedulesData.schedules[course.courseIndex];
    if (!courseSchedule) continue;
    const keys = sortedComponentKeys(courseSchedule);

    const combo: SectionCombo = {};
    let complete = true;
    const count = Math.min(course.componentIndices.length, course.sectionIndices.length);
    for (let i = 0; i < count; i++) {
      const component = keys[course.componentIndices[i]];
      const section = component
        ? courseSchedule.components[component]?.[course.sectionIndices[i]]
        : undefined;
      if (!component || !section) {
        complete = false;
        break;
      }
      combo[component] = { section };
    }
    if (!complete || Object.keys(combo).length === 0) continue;

    enrollments.push(getEnrollmentsForCourse(courseSchedule, combo));
  }

  if (enrollments.length === 0) return null;

  const schedule: GeneratedSchedule = { enrollments };
  return { schedule, colorMap: buildColorMap(schedule) };
}

import type { GeneratedSchedule, ProfessorRatingsMap } from "@uoplan/core";
import {
  getRatingsForInstructors,
  getRatingDetailsForInstructors,
  normalizeCourseCode,
  normalizeProfessorName,
  normalizeGradeVizDistribution,
} from "@uoplan/core";
import type { CalendarEvent } from "./types";

/**
 * Optional course-evaluation sentiment maps (1-5), used to surface satisfaction
 * on calendar events. Both are keyed the way `@uoplan/core` produces them
 * (`courseSentimentByNorm` / `professorSentimentByName`).
 */
export interface ScheduleSentiment {
  courseByNorm?: Map<string, number> | null;
  professorByName?: Map<string, number> | null;
}

export function scheduleToEvents(
  schedule: GeneratedSchedule,
  professorRatings: ProfessorRatingsMap | null,
  sentiment?: ScheduleSentiment | null,
): CalendarEvent[] {
  const courseByNorm = sentiment?.courseByNorm ?? null;
  const professorByName = sentiment?.professorByName ?? null;
  return schedule.enrollments.flatMap((enrollment, enrollIdx) => {
    const aggregateDistribution: Record<string, number> = {};
    for (const { section } of Object.values(enrollment.sectionCombo)) {
      const distribution = section.distribution;
      if (!distribution) continue;
      for (const [grade, countRaw] of Object.entries(distribution)) {
        const count = Number(countRaw);
        if (!Number.isFinite(count) || count <= 0) continue;
        aggregateDistribution[grade] = (aggregateDistribution[grade] ?? 0) + count;
      }
    }
    const gradeViz = normalizeGradeVizDistribution(aggregateDistribution);

    const courseSentiment = courseByNorm
      ? (courseByNorm.get(normalizeCourseCode(enrollment.courseCode)) ?? null)
      : null;

    const out: CalendarEvent[] = [];
    let timeIdx = 0;

    for (const [comp, { section }] of Object.entries(enrollment.sectionCombo)) {
      const sectionCode = section.sectionCode ?? section.section ?? "";
      const componentSection = `${comp} - ${sectionCode}`;
      const sectionInstructors = [
        ...new Set(section.times.map((t) => t.instructor).filter((i): i is string => i !== null)),
      ];
      const professor = sectionInstructors.filter(Boolean).join(", ") || "—";
      const ratings = getRatingsForInstructors(sectionInstructors, professorRatings);
      const professorRatingValue =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;
      const professorRatingDetails = getRatingDetailsForInstructors(
        sectionInstructors,
        professorRatings,
      );
      const professorSentiment = professorByName
        ? averageSentiment(sectionInstructors, professorByName)
        : null;
      // Only surface guesses when there is no confirmed instructor.
      const hasKnownInstructor = sectionInstructors.some(
        (name) => name.trim() !== "" && name !== "Staff",
      );
      const predictedInstructors =
        !hasKnownInstructor && section.predictedInstructors?.length
          ? section.predictedInstructors
          : undefined;

      for (const t of section.times) {
        if (t.startMinutes >= t.endMinutes) continue;

        out.push({
          id: `${enrollment.courseCode}-${comp}-${timeIdx}`,
          courseCode: enrollment.courseCode,
          enrollmentIndex: enrollIdx,
          day: t.day,
          startMinutes: t.startMinutes,
          endMinutes: t.endMinutes,
          componentSection,
          virtual: Boolean(t.virtual),
          professor,
          professorRatingValue,
          professorRatingDetails,
          courseSentiment,
          professorSentiment,
          ...(predictedInstructors ? { predictedInstructors } : {}),
          gradeViz,
          meetingDates: t.meetingDates ?? null,
        });
        timeIdx += 1;
      }
    }
    return out;
  });
}

/** Mean course-evaluation sentiment (1-5) across the instructors that have one. */
function averageSentiment(
  instructors: string[],
  professorByName: Map<string, number>,
): number | null {
  let sum = 0;
  let n = 0;
  const seen = new Set<string>();
  for (const raw of instructors) {
    const key = normalizeProfessorName(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const value = professorByName.get(key);
    if (value != null && Number.isFinite(value)) {
      sum += value;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

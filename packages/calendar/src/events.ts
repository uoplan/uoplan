import type { GeneratedSchedule, ProfessorRatingsMap } from "@uoplan/core";
import {
  getRatingsForInstructors,
  getRatingDetailsForInstructors,
  normalizeGradeVizDistribution,
} from "@uoplan/core";
import type { CalendarEvent } from "./types";

export function scheduleToEvents(
  schedule: GeneratedSchedule,
  professorRatings: ProfessorRatingsMap | null,
): CalendarEvent[] {
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

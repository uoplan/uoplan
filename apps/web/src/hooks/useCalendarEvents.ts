import { useMemo } from "react";
import type { GeneratedSchedule, DayOfWeekCode } from "schedule";
import type { ProfessorRatingsMap } from "schedule";
import {
  getRatingsForInstructors,
  getRatingDetailsForInstructors,
  normalizeGradeVizDistribution,
  type GradeVizData,
} from "schedule";

export interface CalendarEvent {
  id: string;
  courseCode: string;
  enrollmentIndex: number;
  day: DayOfWeekCode;
  startMinutes: number;
  endMinutes: number;
  componentSection: string;
  virtual: boolean;
  professor: string;
  professorRatingValue?: number | null;
  professorRatingDetails?: Array<{
    id?: string;
    legacyId?: number;
    name: string;
    rating: number;
    numRatings: number;
  }>;
  gradeViz?: GradeVizData | null;
}

export function useCalendarEvents(
  schedule: GeneratedSchedule | null,
  professorRatings: ProfessorRatingsMap | null,
): CalendarEvent[] {
  return useMemo<CalendarEvent[]>(() => {
    if (!schedule) return [];

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
            gradeViz,
          });
          timeIdx += 1;
        }
      }
      return out;
    });
  }, [schedule, professorRatings]);
}

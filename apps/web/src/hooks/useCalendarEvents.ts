import { useMemo } from "react";
import type { GeneratedSchedule, ProfessorRatingsMap } from "@uoplan/core";
import { scheduleToEvents, type ScheduleSentiment } from "@uoplan/calendar";

export type { CalendarEvent } from "@uoplan/calendar";

export function useCalendarEvents(
  schedule: GeneratedSchedule | null,
  professorRatings: ProfessorRatingsMap | null,
  sentiment?: ScheduleSentiment | null,
) {
  return useMemo(() => {
    if (!schedule) return [];
    return scheduleToEvents(schedule, professorRatings, sentiment);
  }, [schedule, professorRatings, sentiment]);
}

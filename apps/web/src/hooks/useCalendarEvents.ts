import { useMemo } from "react";
import type { GeneratedSchedule, ProfessorRatingsMap } from "@uoplan/schedule";
import { scheduleToEvents } from "@uoplan/calendar";

export type { CalendarEvent } from "@uoplan/calendar";

export function useCalendarEvents(
  schedule: GeneratedSchedule | null,
  professorRatings: ProfessorRatingsMap | null,
) {
  return useMemo(() => {
    if (!schedule) return [];
    return scheduleToEvents(schedule, professorRatings);
  }, [schedule, professorRatings]);
}

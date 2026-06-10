import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { GeneratedSchedule } from "@uoplan/core";

/**
 * Scan a schedule's meeting dates for the earliest start and latest end date.
 * Either bound is null when no dated meeting times are present. Single source of
 * truth for both the auto-fill hook below and the calendar's displayed range.
 */
export function computeScheduleDateBounds(schedule: GeneratedSchedule | null): {
  start: string | null;
  end: string | null;
} {
  let minStart: string | null = null;
  let maxEnd: string | null = null;
  if (!schedule) return { start: null, end: null };

  for (const enrollment of schedule.enrollments) {
    for (const { section } of Object.values(enrollment.sectionCombo)) {
      for (const t of section.times) {
        const md = t.meetingDates;
        if (!md || md.length < 2) continue;
        const start = md[0];
        const end = md[1];
        if (start && (!minStart || start < minStart)) minStart = start;
        if (end && (!maxEnd || end > maxEnd)) maxEnd = end;
      }
    }
  }

  return { start: minStart, end: maxEnd };
}

export function useTimetableDateRangeFromSchedule(
  schedule: GeneratedSchedule | null,
  timetableStartDate: string,
  timetableEndDate: string,
  setTimetableStartDate: Dispatch<SetStateAction<string>>,
  setTimetableEndDate: Dispatch<SetStateAction<string>>,
) {
  useEffect(() => {
    if (!schedule) return;

    const { start: minStart, end: maxEnd } = computeScheduleDateBounds(schedule);

    // Only auto-fill when the user hasn't provided values yet.
    if (!timetableStartDate && minStart) setTimetableStartDate(minStart);
    if (!timetableEndDate && maxEnd) setTimetableEndDate(maxEnd);
  }, [schedule, timetableStartDate, timetableEndDate, setTimetableStartDate, setTimetableEndDate]);
}

import * as DataProto from "@uoplan/proto/data";
import { dateStringToYyyymmdd } from "@uoplan/core/dataTypes/protoDates";
import { CourseCodeIndexer, parseTermIdToNumber } from "./shared.ts";
import type { ProfessorResolver } from "../professors/buildRegistry.ts";

/** Convert a 0-based registry index (or null) to a 1-based proto ref (undefined = none). */
function toProfessorRef(resolver: ProfessorResolver | undefined, name: string, legacyId?: number) {
  if (!resolver || !name) return;
  const idx = resolver.index(name, legacyId);
  return idx == null ? undefined : idx + 1;
}

interface ScheduleTimeInput {
  day?: string;
  startMinutes?: number;
  endMinutes?: number;
  virtual?: boolean;
  instructor?: string | null;
  meetingDates?: string[];
}

interface ScheduleSectionInput {
  section?: string;
  sectionCode?: string | null;
  component?: string | null;
  session?: string | null;
  times?: ScheduleTimeInput[];
  status?: string | null;
}

interface CourseScheduleInput {
  courseCode?: string;
  title?: string | null;
  timeZone?: string;
  components?: Record<string, ScheduleSectionInput[] | undefined>;
}

export interface SchedulesJsonInput {
  termId?: string;
  totalCourses?: number;
  totalWithSchedules?: number;
  schedules?: CourseScheduleInput[];
}

function dayToProto(day: string | undefined): number {
  switch (day) {
    case "Mo":
      return DataProto.DayOfWeek.DAY_OF_WEEK_MO;
    case "Tu":
      return DataProto.DayOfWeek.DAY_OF_WEEK_TU;
    case "We":
      return DataProto.DayOfWeek.DAY_OF_WEEK_WE;
    case "Th":
      return DataProto.DayOfWeek.DAY_OF_WEEK_TH;
    case "Fr":
      return DataProto.DayOfWeek.DAY_OF_WEEK_FR;
    case "Sa":
      return DataProto.DayOfWeek.DAY_OF_WEEK_SA;
    case "Su":
      return DataProto.DayOfWeek.DAY_OF_WEEK_SU;
    default:
      return DataProto.DayOfWeek.DAY_OF_WEEK_UNSPECIFIED;
  }
}

function sectionStatusToProto(status: unknown): number {
  if (status === "Open") return DataProto.SectionStatus.SECTION_STATUS_OPEN;
  if (status === "Closed") return DataProto.SectionStatus.SECTION_STATUS_CLOSED;
  return DataProto.SectionStatus.SECTION_STATUS_UNSPECIFIED;
}

export function mapSchedules(
  input: SchedulesJsonInput,
  predictions?: Map<string, Array<{ name: string; legacyId?: number }>>,
  resolver?: ProfessorResolver,
) {
  const indexer = new CourseCodeIndexer();

  // Dictionary of distinct (start,end) meeting date ranges for this term. Most
  // meetings share a handful of ranges, so each meeting stores a 1-based ref
  // (0/absent = no range) instead of an inline MeetingDateRange submessage.
  const meetingDateRanges: DataProto.MeetingDateRange[] = [];
  const dateRangeRefByKey = new Map<string, number>();
  const meetingDatesRefOf = (dates: string[] | undefined): number | undefined => {
    if (!Array.isArray(dates) || dates.length < 2) return undefined;
    const start = dateStringToYyyymmdd(String(dates[0] ?? ""));
    const end = dateStringToYyyymmdd(String(dates[1] ?? ""));
    const key = `${start}-${end}`;
    const existing = dateRangeRefByKey.get(key);
    if (existing !== undefined) return existing;
    const ref = meetingDateRanges.length + 1;
    meetingDateRanges.push({ startYyyymmdd: start, endYyyymmdd: end });
    dateRangeRefByKey.set(key, ref);
    return ref;
  };

  const schedules = (input.schedules ?? []).map((schedule) => {
    const courseCode = String(schedule.courseCode ?? "");
    return {
      course: indexer.add(courseCode),
      title: schedule.title ?? undefined,
      timeZone: schedule.timeZone ?? "",
      components: Object.fromEntries(
        Object.entries(schedule.components ?? {}).map(([component, sections]) => [
          component,
          {
            items: (sections ?? []).map((section) => ({
              section: section.section ?? "",
              sectionCode: section.sectionCode ?? undefined,
              component: section.component ?? undefined,
              session: section.session ?? undefined,
              times: (section.times ?? []).map((time) => ({
                day: dayToProto(time.day),
                startMinutes: time.startMinutes ?? 0,
                endMinutes: time.endMinutes ?? 0,
                virtual: Boolean(time.virtual),
                instructor: time.instructor ?? undefined,
                professorRef: toProfessorRef(resolver, time.instructor ?? ""),
                meetingDatesRef: meetingDatesRefOf(time.meetingDates),
              })),
              status: sectionStatusToProto(section.status),
              predictedInstructors: (
                predictions?.get(`${courseCode}\u0000${component}\u0000${section.section ?? ""}`) ??
                []
              ).map((p) => ({
                name: p.name,
                legacyId: p.legacyId ?? undefined,
                professorRef: toProfessorRef(resolver, p.name, p.legacyId),
              })),
            })),
          },
        ]),
      ),
    };
  });

  return {
    termId: parseTermIdToNumber(String(input.termId ?? "")),
    courseCodes: indexer.courseCodes,
    totalCourses: input.totalCourses,
    totalWithSchedules: input.totalWithSchedules,
    schedules,
    meetingDateRanges,
  };
}

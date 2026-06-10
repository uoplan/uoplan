import * as DataProto from "@uoplan/proto/data";
import { CourseCodeIndexer, parseTermIdToNumber } from "./shared.ts";
import type { ProfessorResolver } from "../professors/buildRegistry.ts";

/** Convert a 0-based registry index (or null) to a 1-based proto ref (undefined = none). */
function toProfessorRef(resolver: ProfessorResolver | undefined, name: string, legacyId?: number) {
  if (!resolver || !name) return undefined;
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

function dateStringToYyyymmdd(value: string): number {
  const compact = value.replaceAll("-", "");
  const parsed = Number.parseInt(compact, 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

  return {
    termId: parseTermIdToNumber(String(input.termId ?? "")),
    courseCodes: indexer.courseCodes,
    totalCourses: input.totalCourses,
    totalWithSchedules: input.totalWithSchedules,
    schedules: (input.schedules ?? []).map((schedule) => {
      const courseCode = String(schedule.courseCode ?? "");
      return {
        course: { index: indexer.add(courseCode) },
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
                  meetingDates:
                    Array.isArray(time.meetingDates) && time.meetingDates.length >= 2
                      ? {
                          startYyyymmdd: dateStringToYyyymmdd(String(time.meetingDates[0] ?? "")),
                          endYyyymmdd: dateStringToYyyymmdd(String(time.meetingDates[1] ?? "")),
                        }
                      : undefined,
                })),
                status: sectionStatusToProto(section.status),
                predictedInstructors: (
                  predictions?.get(
                    `${courseCode}\u0000${component}\u0000${section.section ?? ""}`,
                  ) ?? []
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
    }),
  };
}

import type {
  ComponentSection,
  CourseSchedule,
  MeetingTime,
  SchedulesData,
} from "@uoplan/domain/dataTypes";
import type { CarletonLinkedGroup, CarletonSection } from "./parseCourseSearch.ts";

export interface CarletonSectionLinks {
  crn: string;
  courseCode: string;
  section: string;
  linkedGroups: CarletonLinkedGroup[];
}

const SCHEDULE_TYPE_COMPONENTS: Record<string, string> = {
  Laboratory: "LAB",
  Lecture: "LEC",
  "Non-Term Credit": "NTC",
  Practical: "PRA",
  Recitation: "REC",
  Seminar: "SEM",
  Studio: "STG",
  Test: "TST",
  Tutorial: "TUT",
};

function componentCodeForScheduleType(scheduleType: string): string {
  const mapped = SCHEDULE_TYPE_COMPONENTS[scheduleType];
  if (mapped) return mapped;
  // Fallback for rare Banner schedule labels not yet present in fixtures/domain data.
  return (
    scheduleType
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0]!.toUpperCase())
      .join("")
      .slice(0, 4) || "UNK"
  );
}

function meetingTimes(section: CarletonSection): MeetingTime[] {
  const times: MeetingTime[] = [];
  for (const meeting of section.meetings) {
    if (meeting.startMinutes == null || meeting.endMinutes == null) continue;
    for (const day of meeting.days) {
      times.push({
        day,
        startMinutes: meeting.startMinutes,
        endMinutes: meeting.endMinutes,
        virtual: section.virtual,
        instructor: section.instructor,
        meetingDates:
          meeting.startDate && meeting.endDate ? [meeting.startDate, meeting.endDate] : null,
      });
    }
  }
  return times;
}

function toComponentSection(section: CarletonSection, component: string): ComponentSection {
  return {
    section: `${section.section}-${component}`,
    sectionCode: section.section,
    component,
    session: null,
    times: meetingTimes(section),
    status: section.status,
  };
}

function sortSections(a: ComponentSection, b: ComponentSection): number {
  return (a.sectionCode ?? "").localeCompare(b.sectionCode ?? "", "en", { numeric: true });
}

export function toSchedulesData(termId: string, sections: CarletonSection[]): SchedulesData {
  const byCourse = new Map<string, CourseSchedule>();

  for (const section of sections) {
    const schedule: CourseSchedule = byCourse.get(section.courseCode) ?? {
      subject: section.subject,
      catalogNumber: section.catalogNumber,
      courseCode: section.courseCode as CourseSchedule["courseCode"],
      title: section.title || null,
      timeZone: "America/Toronto",
      components: {},
    };
    const component = componentCodeForScheduleType(section.scheduleType);
    schedule.components[component] ??= [];
    schedule.components[component].push(toComponentSection(section, component));
    byCourse.set(section.courseCode, schedule);
  }

  const schedules = [...byCourse.values()].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  for (const schedule of schedules) {
    for (const sectionsForComponent of Object.values(schedule.components)) {
      sectionsForComponent.sort(sortSections);
    }
  }

  return {
    termId,
    totalCourses: schedules.length,
    totalWithSchedules: schedules.filter((schedule) => Object.keys(schedule.components).length > 0)
      .length,
    schedules,
  };
}

export function buildLinkGraph(sections: CarletonSection[]): Record<string, CarletonSectionLinks> {
  const links: Record<string, CarletonSectionLinks> = {};
  for (const section of sections) {
    if (section.linkedGroups.length === 0) continue;
    links[section.crn] = {
      crn: section.crn,
      courseCode: section.courseCode,
      section: section.section,
      linkedGroups: section.linkedGroups,
    };
  }
  return links;
}

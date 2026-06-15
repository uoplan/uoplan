import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { SchedulesData } from "@uoplan/core/dataTypes";

import {
  explainUnpredictedInstructors,
  unpredictedReasonLabel,
} from "@/data/course-schedule-prediction";
import {
  courseScheduleDetail,
  courseScheduleEvents,
  courseScheduleTerms,
} from "@/data/explore-detail";

const schedules: SchedulesData = {
  termId: "20259",
  schedules: [
    {
      subject: "CSI",
      catalogNumber: "2110",
      courseCode: normalizeCourseCode("CSI 2110"),
      title: "Data Structures and Algorithms",
      timeZone: "America/Toronto",
      components: {
        LEC: [
          {
            section: "A",
            sectionCode: "A00",
            component: "LEC",
            session: null,
            status: "Open",
            times: [
              {
                day: "Mo",
                startMinutes: 10 * 60,
                endMinutes: 11 * 60 + 30,
                virtual: false,
                instructor: "Ada Lovelace",
              },
              {
                day: "We",
                startMinutes: 10 * 60,
                endMinutes: 11 * 60 + 30,
                virtual: false,
                instructor: "Ada Lovelace",
              },
            ],
          },
        ],
        DGD: [
          {
            section: "A01",
            sectionCode: "A01",
            component: "DGD",
            session: null,
            status: "Closed",
            times: [
              {
                day: "Fr",
                startMinutes: 14 * 60,
                endMinutes: 14 * 60,
                virtual: false,
                instructor: "Staff",
              },
            ],
          },
        ],
      },
    },
  ],
};

describe("course schedule view-model", () => {
  it("maps a course schedule into week-calendar events", () => {
    const events = courseScheduleEvents(schedules.schedules[0]!);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: "CSI 2110-LEC-A00-0",
      courseCode: "CSI 2110",
      day: "Mo",
      startMinutes: 600,
      endMinutes: 690,
      componentSection: "LEC - A00",
      professor: "Ada Lovelace",
    });
  });

  describe("unpredicted instructor reason labels", () => {
    it("resolves the core explanation helper for empty historical pools", () => {
      expect(
        explainUnpredictedInstructors({
          courseCode: normalizeCourseCode("CSI 2110"),
          section: schedules.schedules[0]!.components.DGD![0]!,
          termSchedules: schedules.schedules,
          termId: Number(schedules.termId),
          courseGrades: [],
          predicted: [],
        }),
      ).toEqual([]);
    });

    it("formats a conflict reason with the overlapping class time", () => {
      expect(
        unpredictedReasonLabel({
          kind: "conflict",
          courseCode: normalizeCourseCode("MAT 1320"),
          component: "LEC",
          section: "Z00",
          day: "Mo",
          startMinutes: 10 * 60,
          endMinutes: 11 * 60 + 30,
        }),
      ).toBe("Teaching MAT 1320 Z00 (Mon 10:00–11:30)");
    });

    it("formats non-conflict explanations in concise English", () => {
      expect(unpredictedReasonLabel({ kind: "stale", lastYear: 2017 })).toBe(
        "Hasn't taught it since 2017",
      );
      expect(unpredictedReasonLabel({ kind: "inactive" })).toBe("Not teaching this term");
      expect(unpredictedReasonLabel({ kind: "lowerPriority", lastYear: 2024 })).toBe(
        "A more recent instructor was predicted",
      );
    });
  });

  it("resolves the requested term and normalizes compact course params", () => {
    const detail = courseScheduleDetail(new Map([["20259", schedules]]), "csi2110", "20259");

    expect(detail?.course.courseCode).toBe("CSI 2110");
    expect(detail?.termId).toBe("20259");
    expect(detail?.meetingCount).toBe(2);
    expect(detail?.sectionCount).toBe(2);
  });

  it("lists the terms a course is offered in, newest first", () => {
    const older: SchedulesData = { ...schedules, termId: "20249" };
    const byTerm = new Map([
      ["20249", older],
      ["20259", schedules],
    ]);

    expect(courseScheduleTerms(byTerm, "csi2110")).toEqual([20259, 20249]);
    expect(courseScheduleTerms(byTerm, "MAT 1320")).toEqual([]);
    expect(courseScheduleTerms(byTerm, undefined)).toEqual([]);
  });
});

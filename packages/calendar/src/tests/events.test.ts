import { describe, expect, it } from "vitest";
import { normalizeProfessorName, unsafeBrand } from "@uoplan/core";
import type { CanonicalProfessorName } from "@uoplan/core";
import { scheduleToEvents } from "../events";
import { makeSchedule } from "./fixtures";

describe("scheduleToEvents", () => {
  it("flattens valid section times into calendar events with course metadata and aggregate grades", () => {
    const schedule = makeSchedule([
      {
        courseCode: "CSI 2101",
        sections: [
          {
            component: "LEC",
            sectionCode: "A",
            distribution: { A: 2, B: 1 },
            times: [
              {
                day: "Mo",
                startMinutes: 540,
                endMinutes: 600,
                virtual: true,
                instructor: "Ada Lovelace",
                meetingDates: ["2026-01-05", "2026-04-06"],
              },
              {
                day: "We",
                startMinutes: 700,
                endMinutes: 700,
                instructor: "Ada Lovelace",
              },
            ],
          },
          {
            component: "DGD",
            sectionCode: "B",
            distribution: { A: 1, F: 1 },
            times: [
              {
                day: "Fr",
                startMinutes: 720,
                endMinutes: 780,
                instructor: "Ada Lovelace",
              },
            ],
          },
        ],
      },
    ]);

    const events = scheduleToEvents(schedule, null);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: "CSI 2101-LEC-0",
      courseCode: "CSI 2101",
      enrollmentIndex: 0,
      day: "Mo",
      startMinutes: 540,
      endMinutes: 600,
      componentSection: "LEC - A",
      virtual: true,
      professor: "Ada Lovelace",
      professorRatingValue: null,
      professorRatingDetails: [],
      meetingDates: ["2026-01-05", "2026-04-06"],
    });
    expect(events[0].gradeViz?.total).toBe(5);
    expect(events[0].gradeViz?.passingPercent).toBe(80);
    expect(events[1]).toMatchObject({
      id: "CSI 2101-DGD-1",
      day: "Fr",
      componentSection: "DGD - B",
      virtual: false,
      professor: "Ada Lovelace",
      meetingDates: null,
    });
    expect(events.map((event) => event.day)).not.toContain("We");
  });

  it("uses the unassigned professor sentinel and exposes predicted instructors only for unknown staff", () => {
    const schedule = makeSchedule([
      {
        courseCode: "MAT 1320",
        sections: [
          {
            component: "LEC",
            sectionCode: "A",
            predictedInstructors: [{ name: "Grace Hopper" }],
            times: [
              {
                day: "Tu",
                startMinutes: 600,
                endMinutes: 660,
                instructor: "Staff",
              },
            ],
          },
        ],
      },
      {
        courseCode: "PHY 1124",
        sections: [
          {
            component: "LAB",
            sectionCode: "C",
            predictedInstructors: [{ name: "Alan Turing" }],
            times: [
              {
                day: "Th",
                startMinutes: 840,
                endMinutes: 900,
                instructor: "Marie Curie",
              },
            ],
          },
        ],
      },
    ]);

    const events = scheduleToEvents(schedule, null);

    expect(events[0]).toMatchObject({
      courseCode: "MAT 1320",
      professor: "—",
      predictedInstructors: [{ name: "Grace Hopper" }],
      predictedRatingDetails: [],
    });
    expect(events[1]).toMatchObject({
      courseCode: "PHY 1124",
      professor: "Marie Curie",
    });
    expect(events[1].predictedInstructors).toBeUndefined();
  });

  it("attaches course and professor sentiment using normalized course and instructor keys", () => {
    const schedule = makeSchedule([
      {
        courseCode: "CSI 2101",
        sections: [
          {
            component: "LEC",
            sectionCode: "A",
            times: [
              {
                day: "Mo",
                startMinutes: 540,
                endMinutes: 600,
                instructor: "Ada Lovelace",
              },
              {
                day: "We",
                startMinutes: 540,
                endMinutes: 600,
                instructor: "Ada Lovelace",
              },
              {
                day: "Fr",
                startMinutes: 540,
                endMinutes: 600,
                instructor: "Grace Hopper",
              },
            ],
          },
        ],
      },
    ]);

    const events = scheduleToEvents(schedule, null, {
      courseByNorm: new Map([["CSI 2101", 4.25]]),
      professorByName: new Map([
        [normalizeProfessorName("Ada Lovelace"), 5],
        [normalizeProfessorName("Grace Hopper"), 3],
      ]),
    });

    expect(events).toHaveLength(3);
    expect(events[0].courseSentiment).toBe(4.25);
    expect(events[0].professorSentiment).toBe(4);
  });

  it("averages sentiment across predicted instructors when a section has no known instructor", () => {
    const schedule = makeSchedule([
      {
        courseCode: "MAT 1320",
        sections: [
          {
            component: "LEC",
            sectionCode: "A",
            predictedInstructors: [{ name: "Grace Hopper" }, { name: "Alan Turing" }],
            times: [
              {
                day: "Tu",
                startMinutes: 600,
                endMinutes: 660,
                instructor: null,
              },
            ],
          },
        ],
      },
    ]);

    const events = scheduleToEvents(schedule, null, {
      professorByName: new Map([
        [normalizeProfessorName("Grace Hopper"), 4],
        [normalizeProfessorName("Alan Turing"), 2],
      ]),
    });

    expect(events[0].professor).toBe("—");
    expect(events[0].predictedInstructors?.map((p) => p.name)).toEqual([
      unsafeBrand<CanonicalProfessorName>("Grace Hopper"),
      unsafeBrand<CanonicalProfessorName>("Alan Turing"),
    ]);
    expect(events[0].professorSentiment).toBe(3);
  });
});

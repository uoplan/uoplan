import { describe, expect, it } from "vitest";

import { SchedulePreview } from "@uoplan/proto/state";
import type { CourseSchedule, SchedulesData } from "../dataTypes";
import type { GeneratedSchedule } from "../generation/types";
import { buildColorMap } from "../utils/uiUtils";
import { buildSchedulePreview, reconstructScheduleFromPreview } from "../schedulePreview";

function makeSchedule(
  courseCode: string,
  components: CourseSchedule["components"],
): CourseSchedule {
  const [subject = "", catalogNumber = ""] = courseCode.split(/\s+/);
  return {
    subject,
    catalogNumber,
    courseCode,
    title: courseCode,
    timeZone: "America/Toronto",
    components,
  };
}

const schedulesData: SchedulesData = {
  termId: "2261",
  schedules: [
    makeSchedule("ITI 1120", {
      LEC: [
        {
          section: "A00-LEC",
          sectionCode: "A00",
          component: "LEC",
          session: null,
          status: "Open",
          times: [{ day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false }],
          distribution: { "A+": 5, B: 3 },
        },
        {
          section: "A01-LEC",
          sectionCode: "A01",
          component: "LEC",
          session: null,
          status: "Open",
          times: [{ day: "Tu", startMinutes: 600, endMinutes: 690, virtual: false }],
        },
      ],
      LAB: [
        {
          section: "L01-LAB",
          sectionCode: "L01",
          component: "LAB",
          session: null,
          status: "Open",
          times: [{ day: "We", startMinutes: 780, endMinutes: 870, virtual: false }],
        },
      ],
    }),
    makeSchedule("MAT 1320", {
      LEC: [
        {
          section: "B00-LEC",
          sectionCode: "B00",
          component: "LEC",
          session: null,
          status: "Open",
          times: [{ day: "Th", startMinutes: 540, endMinutes: 630, virtual: false }],
        },
      ],
    }),
  ],
};

/** Build a GeneratedSchedule directly from the dataset (as the engine would). */
function generatedSchedule(): GeneratedSchedule {
  const iti = schedulesData.schedules[0];
  const mat = schedulesData.schedules[1];
  return {
    enrollments: [
      {
        courseCode: "ITI 1120",
        sectionCombo: {
          LEC: { section: iti.components.LEC[0] },
          LAB: { section: iti.components.LAB[0] },
        },
        times: [],
      },
      {
        courseCode: "MAT 1320",
        sectionCombo: { LEC: { section: mat.components.LEC[0] } },
        times: [],
      },
    ],
  };
}

describe("schedulePreview index encoding", () => {
  it("encodes a schedule to indices into the schedules dataset", () => {
    const preview = buildSchedulePreview(generatedSchedule(), schedulesData, 2261);
    expect(preview.termId).toBe(2261);
    expect(preview.courses).toEqual([
      // ITI 1120 is course 0; sorted component keys are ["LAB", "LEC"].
      {
        courseIndex: 0,
        componentIndices: [1, 0], // LEC A00, LAB L01
        sectionIndices: [0, 0],
      },
      // MAT 1320 is course 1; only component is LEC.
      { courseIndex: 1, componentIndices: [0], sectionIndices: [0] },
    ]);
  });

  it("round-trips through protobuf encode/decode and reconstruction", () => {
    const preview = buildSchedulePreview(generatedSchedule(), schedulesData, 2261);
    const bytes = SchedulePreview.encode(preview).finish();
    const decoded = SchedulePreview.decode(bytes);

    const result = reconstructScheduleFromPreview(decoded, schedulesData);
    expect(result).not.toBeNull();
    const { schedule, colorMap } = result!;

    expect(schedule.enrollments.map((e) => e.courseCode)).toEqual(["ITI 1120", "MAT 1320"]);

    const iti = schedule.enrollments[0];
    expect(Object.keys(iti.sectionCombo).sort()).toEqual(["LAB", "LEC"]);
    expect(iti.sectionCombo.LEC.section.sectionCode).toBe("A00");
    expect(iti.sectionCombo.LAB.section.sectionCode).toBe("L01");
    expect(iti.times).toEqual(
      expect.arrayContaining([
        { day: "Mo", startMinutes: 600, endMinutes: 690, meetingDates: null },
        { day: "We", startMinutes: 780, endMinutes: 870, meetingDates: null },
      ]),
    );

    expect(colorMap).toEqual(buildColorMap(schedule));
  });

  it("returns null when no course resolves (wrong term data)", () => {
    const preview: SchedulePreview = {
      termId: 9999,
      courses: [{ courseIndex: 99, componentIndices: [0], sectionIndices: [0] }],
    };
    expect(reconstructScheduleFromPreview(preview, schedulesData)).toBeNull();
  });

  it("skips courses whose section index is out of range", () => {
    const preview: SchedulePreview = {
      termId: 2261,
      courses: [
        { courseIndex: 0, componentIndices: [1], sectionIndices: [0] }, // ITI LEC A00
        { courseIndex: 1, componentIndices: [0], sectionIndices: [5] }, // MAT bad index
      ],
    };
    const result = reconstructScheduleFromPreview(preview, schedulesData);
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["ITI 1120"]);
  });
});

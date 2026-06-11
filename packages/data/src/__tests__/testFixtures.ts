import { vi } from "vitest";
import {
  DataProto,
  normalizeCourseCode,
  toProtoCatalogue,
  toProtoSchedulesData,
} from "@uoplan/core";
import type { Catalogue, Course, SchedulesData } from "@uoplan/core";

export function course(code: string, title: string, credits = 3): Course {
  return {
    code: normalizeCourseCode(code),
    title,
    credits,
    description: "",
    component: "Lecture",
  };
}

export function encode(message: { finish(): Uint8Array }): Uint8Array {
  return message.finish();
}

export function catalogueBytes(catalogue: Catalogue): Uint8Array {
  return encode(DataProto.Catalogue.encode(toProtoCatalogue(catalogue)));
}

export function schedulesBytes(schedules: SchedulesData): Uint8Array {
  return encode(DataProto.SchedulesData.encode(toProtoSchedulesData(schedules)));
}

export function schedulesFor(termId: string): SchedulesData {
  return {
    termId,
    schedules: [
      {
        subject: "CSI",
        catalogNumber: "2110",
        courseCode: normalizeCourseCode("CSI 2110"),
        title: "Data Structures",
        timeZone: "America/Toronto",
        components: {
          LEC: [
            {
              section: "A00",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              status: "Open",
              times: [
                {
                  day: "Mo",
                  startMinutes: 600,
                  endMinutes: 690,
                  virtual: false,
                  instructor: "Alice Smith",
                  meetingDates: ["2026-01-12", "2026-04-10"],
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export function fetchFrom(assets: Record<string, Uint8Array | Error>) {
  return vi.fn(async (id: string) => {
    const value = assets[id];
    if (value === undefined) throw new Error(`Missing fixture for ${id}`);
    if (value instanceof Error) throw value;
    return value;
  });
}

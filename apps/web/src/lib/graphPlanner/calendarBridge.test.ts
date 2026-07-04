import { describe, expect, it } from "vitest";
import { planCoursesFromCalendar } from "./calendarBridge";

describe("planCoursesFromCalendar", () => {
  it("uses the scheduled enrollments when a schedule exists", () => {
    const schedule = {
      enrollments: [{ courseCode: "CSI 3105" }, { courseCode: "MAT 2377" }],
    };
    expect(planCoursesFromCalendar(schedule, ["ITI 1120"])).toEqual(["CSI 3105", "MAT 2377"]);
  });

  it("dedupes repeated course codes from the schedule", () => {
    const schedule = {
      enrollments: [
        { courseCode: "CSI 3105" },
        { courseCode: "CSI 3105" },
        { courseCode: "MAT 2377" },
      ],
    };
    expect(planCoursesFromCalendar(schedule, [])).toEqual(["CSI 3105", "MAT 2377"]);
  });

  it("falls back to the cart when no schedule has been generated", () => {
    expect(planCoursesFromCalendar(null, ["ITI 1120", "ITI 1121"])).toEqual([
      "ITI 1120",
      "ITI 1121",
    ]);
    expect(planCoursesFromCalendar({ enrollments: [] }, ["ITI 1120"])).toEqual(["ITI 1120"]);
  });

  it("returns a fresh array (never the caller's cart reference)", () => {
    const cart = ["ITI 1120"];
    const result = planCoursesFromCalendar(null, cart);
    expect(result).not.toBe(cart);
    expect(result).toEqual(cart);
  });
});

import { isPersonalizationIncomplete } from "@/lib/personalization";

describe("isPersonalizationIncomplete", () => {
  it("is incomplete when no program, no start year, and no completed courses", () => {
    expect(
      isPersonalizationIncomplete({
        programUrl: null,
        startYear: null,
        completedCourseCount: 0,
      }),
    ).toBe(true);
  });

  it("is complete once a program is selected", () => {
    expect(
      isPersonalizationIncomplete({
        programUrl: "https://example.test/cs",
        startYear: null,
        completedCourseCount: 0,
      }),
    ).toBe(false);
  });

  it("is complete once a start year is selected", () => {
    expect(
      isPersonalizationIncomplete({
        programUrl: null,
        startYear: "2024",
        completedCourseCount: 0,
      }),
    ).toBe(false);
  });

  it("is complete once at least one completed course is added", () => {
    expect(
      isPersonalizationIncomplete({
        programUrl: null,
        startYear: null,
        completedCourseCount: 3,
      }),
    ).toBe(false);
  });
});

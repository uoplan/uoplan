import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "../i18n";
import { formatWeekCount } from "./formatWeekCount";

beforeAll(async () => {
  const { messages } = await import("@uoplan/i18n/catalogs/en");
  i18n.load("en", messages);
  i18n.activate("en");
});

describe("formatWeekCount", () => {
  it("returns '1 week' for a single-week group", () => {
    // Mon Aug 24 – Sun Aug 30
    expect(formatWeekCount({ startDate: "2026-08-24", endDate: "2026-08-30" })).toBe("1 week");
  });

  it("returns 'repeats for N weeks' for THE 1102 (Mon Aug 24 – Fri Sep 4, grouped Mon–Sun Sep 6)", () => {
    // Two active weeks: Aug 24–28 and Aug 31–Sep 4.
    // computeWeekGroups sets endDate to Sunday of the last week → 2026-09-06.
    expect(formatWeekCount({ startDate: "2026-08-24", endDate: "2026-09-06" })).toBe(
      "repeats for 2 weeks",
    );
  });

  it("returns 'repeats for N weeks' for a three-week group", () => {
    // Mon Aug 24 – Sun Sep 13
    expect(formatWeekCount({ startDate: "2026-08-24", endDate: "2026-09-13" })).toBe(
      "repeats for 3 weeks",
    );
  });

  it("returns 'repeats for N weeks' for a typical full-semester group", () => {
    // Mon Sep 7 – Sun Dec 27 (16 weeks)
    expect(formatWeekCount({ startDate: "2026-09-07", endDate: "2026-12-27" })).toBe(
      "repeats for 16 weeks",
    );
  });
});

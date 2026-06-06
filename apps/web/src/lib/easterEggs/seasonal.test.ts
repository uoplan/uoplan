import { describe, expect, it } from "vitest";
import { seasonalFlourish } from "./seasonal";

describe("seasonalFlourish", () => {
  it("returns the New Year flourish on January 1", () => {
    const result = seasonalFlourish(new Date(2026, 0, 1));
    expect(result).toEqual({ emoji: "🎉", msgId: "easterEgg.seasonal.newYear" });
  });

  it("returns the April Fools flourish on April 1", () => {
    expect(seasonalFlourish(new Date(2026, 3, 1))?.msgId).toBe("easterEgg.seasonal.aprilFools");
  });

  it("returns the Canada Day flourish on July 1", () => {
    expect(seasonalFlourish(new Date(2026, 6, 1))?.msgId).toBe("easterEgg.seasonal.canadaDay");
  });

  it("returns the Halloween flourish on October 31", () => {
    expect(seasonalFlourish(new Date(2026, 9, 31))?.msgId).toBe("easterEgg.seasonal.halloween");
  });

  it("returns the exam-season flourish in early December", () => {
    expect(seasonalFlourish(new Date(2026, 11, 10))?.msgId).toBe("easterEgg.seasonal.examSeason");
  });

  it("returns the holidays flourish in late December", () => {
    expect(seasonalFlourish(new Date(2026, 11, 25))?.msgId).toBe("easterEgg.seasonal.holidays");
  });

  it("returns the winter flourish on an ordinary January day", () => {
    expect(seasonalFlourish(new Date(2026, 0, 15))?.msgId).toBe("easterEgg.seasonal.winter");
  });

  it("returns null on an ordinary day with no flourish", () => {
    expect(seasonalFlourish(new Date(2026, 4, 15))).toBeNull();
  });
});

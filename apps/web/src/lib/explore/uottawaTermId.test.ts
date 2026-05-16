import { describe, expect, it } from "vitest";
import { formatUottawaTermIdLabel } from "./uottawaTermId";

describe("formatUottawaTermIdLabel", () => {
  it("formats Fall / Winter / Spring–Summer 4-digit streams", () => {
    expect(formatUottawaTermIdLabel(2269)).toBe("Fall Term 2026");
    expect(formatUottawaTermIdLabel(2271)).toBe("Winter Term 2027");
    expect(formatUottawaTermIdLabel(2275)).toBe("Spring/Summer Term 2027");
    expect(formatUottawaTermIdLabel(2261)).toBe("Winter Term 2026");
  });

  it("falls back to digits for unknown lengths or session digits", () => {
    expect(formatUottawaTermIdLabel(999)).toBe("999");
    expect(formatUottawaTermIdLabel(2260)).toBe("2260");
    expect(formatUottawaTermIdLabel(1269)).toBe("1269");
  });
});

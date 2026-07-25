import { describe, expect, it } from "vitest";

import { parseTerms } from "./parseTerms.ts";
import { readFixture } from "./testUtils.ts";

describe("parseTerms", () => {
  it("parses term options and the Banner session id", () => {
    const result = parseTerms(readFixture("select-term.html"));

    expect(result.sessionId).toBe("26061541");
    expect(result.terms).toEqual([
      { termId: "202620", name: "Summer 2026" },
      { termId: "202630", name: "Fall 2026" },
      { termId: "202710", name: "Winter 2027" },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { parseSchoolArg, stripSchoolArgs } from "./cliSchool.ts";

describe("parseSchoolArg", () => {
  it("defaults to uOttawa when --school is absent", () => {
    expect(parseSchoolArg(["node", "script.ts"])).toBe("uottawa");
  });

  it("accepts --school=<id>", () => {
    expect(parseSchoolArg(["node", "script.ts", "--school=carleton"])).toBe("carleton");
  });

  it("accepts --school <id>", () => {
    expect(parseSchoolArg(["node", "script.ts", "--school", "carleton"])).toBe("carleton");
  });

  it("rejects an invalid school with the allowed ids", () => {
    expect(() => parseSchoolArg(["node", "script.ts", "--school", "waterloo"])).toThrow(
      'Invalid --school value "waterloo". Expected one of: uottawa, carleton.',
    );
  });

  it("rejects a missing --school value", () => {
    expect(() => parseSchoolArg(["node", "script.ts", "--school"])).toThrow(
      "Missing value for --school. Expected one of: uottawa, carleton.",
    );
  });

  it("removes --school flags before command-specific parsing", () => {
    expect(stripSchoolArgs(["fetch", "--school=carleton", "--force"])).toEqual([
      "fetch",
      "--force",
    ]);
    expect(stripSchoolArgs(["--school", "carleton", "fetch"])).toEqual(["fetch"]);
  });
});

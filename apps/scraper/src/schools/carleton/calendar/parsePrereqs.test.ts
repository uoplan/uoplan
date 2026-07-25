import { describe, expect, it } from "vitest";

import { parseCarletonPrereqs } from "./parsePrereqs.ts";

describe("parseCarletonPrereqs", () => {
  it("parses parenthesized course alternatives with trailing grade prose", () => {
    expect(parseCarletonPrereqs("(COMP 1006 or COMP 1406) with a minimum grade of C-.")).toEqual({
      type: "or_group",
      text: "COMP 1006 or COMP 1406",
      children: [
        { type: "course", code: "COMP 1006", text: "COMP 1006" },
        { type: "course", code: "COMP 1406", text: "COMP 1406" },
      ],
    });
  });

  it("parses course conjunctions", () => {
    expect(parseCarletonPrereqs("COMP 2401 and COMP 2402")).toEqual({
      type: "and_group",
      text: "COMP 2401 and COMP 2402",
      children: [
        { type: "course", code: "COMP 2401", text: "COMP 2401" },
        { type: "course", code: "COMP 2402", text: "COMP 2402" },
      ],
    });
  });

  it("classifies permission prose", () => {
    expect(parseCarletonPrereqs("Permission of the Department.")).toEqual({
      type: "non_course",
      text: "Permission of the Department",
      kind: "permission",
    });
  });

  it("classifies standing prose", () => {
    expect(parseCarletonPrereqs("Third-year standing")).toEqual({
      type: "non_course",
      text: "Third-year standing",
      kind: "standing",
    });
  });

  it("parses credit pools by discipline", () => {
    expect(parseCarletonPrereqs("4.0 credits in COMP")).toEqual({
      type: "non_course",
      text: "4.0 credits in COMP",
      credits: 4,
      disciplines: ["COMP"],
    });
  });

  it("keeps equivalent alternatives instead of dropping them", () => {
    expect(parseCarletonPrereqs("COMP 1006 or equivalent")).toEqual({
      type: "or_group",
      text: "COMP 1006 or equivalent",
      children: [
        { type: "course", code: "COMP 1006", text: "COMP 1006" },
        { type: "non_course", text: "equivalent", kind: "equivalent" },
      ],
    });
  });
});

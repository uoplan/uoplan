import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { fromProtoIndices, toProtoIndices } from "../dataTypes/indices";
import type { Indices } from "../dataTypes";

function roundTrip(input: Indices): Indices {
  const bytes = DataProto.Indices.encode(toProtoIndices(input)).finish();
  return fromProtoIndices(DataProto.Indices.decode(bytes));
}

describe("indices columnar round-trip", () => {
  it("preserves leading-zero, five-digit, suffixed, and out-of-pattern codes", () => {
    const courses = [
      "ESL 0105", // leading zero, < 1000
      "ESL 0110",
      "CSI 2110", // ordinary 4-digit
      "CSI 2120",
      "AMT 40101", // five-digit number
      "ADM 6385I", // letter suffix
      "ADM 6386I",
      "MAT 1320", // interleaved discipline to exercise delta-within-discipline
      "CSI 1100", // negative delta within CSI (1100 < 2120)
      "ESL 0111",
    ];
    const programs = [
      "Honours Computer Science",
      "Honours Computer Science with Option in Data Science",
      "Major in Mathematics",
    ];
    const result = roundTrip({ courses, programs, disciplines: [] });
    expect(result.courses).toEqual(courses);
    expect(result.programs).toEqual(programs);
  });

  it("derives the discipline dictionary in first-occurrence order", () => {
    const proto = toProtoIndices({
      courses: ["MAT 1320", "CSI 2110", "MAT 1330", "PHY 1100"],
      programs: [],
      disciplines: [],
    });
    expect(proto.disciplines).toEqual(["MAT", "CSI", "PHY"]);
  });

  it("handles >128 disciplines (varint index boundary)", () => {
    // 150 distinct disciplines, one course each, to exercise discipline indices
    // past the single-byte varint boundary (128).
    const many: string[] = [];
    for (let d = 0; d < 150; d++) {
      const a = String.fromCharCode(65 + Math.floor(d / 26));
      const b = String.fromCharCode(65 + (d % 26));
      many.push(`${a}${b}X ${1000 + d}`);
    }
    const result = roundTrip({ courses: many, programs: [], disciplines: [] });
    expect(result.courses).toEqual(many);
    expect(
      toProtoIndices({ courses: many, programs: [], disciplines: [] }).disciplines.length,
    ).toBe(150);
  });

  it("falls back to a literal for codes that do not match the pattern", () => {
    const courses = ["CSI 2110", "WEIRD-CODE!!", "MAT 1320"];
    const result = roundTrip({ courses, programs: [], disciplines: [] });
    expect(result.courses).toEqual(courses);
  });

  it("round-trips an empty payload", () => {
    expect(roundTrip({ courses: [], programs: [], disciplines: [] })).toEqual({
      courses: [],
      programs: [],
      disciplines: [],
    });
  });
});

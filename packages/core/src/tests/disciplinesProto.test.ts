import { describe, expect, it } from "vitest";
import { fromProtoDisciplinesData, toProtoDisciplinesData } from "../dataTypes";
import { unsafeBrand } from "../brand";
import type { FacultyId } from "../brand";
import type { DisciplinesData } from "../dataTypes";
import * as DataProto from "@uoplan/proto/data";

const sample: DisciplinesData = {
  faculties: [
    {
      id: unsafeBrand<FacultyId>("engineering"),
      name: "Faculty of Engineering",
      nameFr: "Faculté de génie",
    },
    { id: unsafeBrand<FacultyId>("arts"), name: "Faculty of Arts", nameFr: "Faculté des arts" },
  ],
  disciplines: [
    {
      code: "CSI",
      name: "Computer Science",
      nameFr: "Informatique",
      facultyId: unsafeBrand<FacultyId>("engineering"),
    },
    { code: "ENG", name: "English", nameFr: "Anglais", facultyId: unsafeBrand<FacultyId>("arts") },
    // A discipline with no faculty must round-trip without a facultyId.
    { code: "MRP", name: "Major Research Paper" },
  ],
};

describe("DisciplinesData proto round-trip", () => {
  it("preserves faculties and the per-discipline faculty link through encode/decode", () => {
    const proto = DataProto.DisciplinesData.encode(toProtoDisciplinesData(sample)).finish();
    const decoded = fromProtoDisciplinesData(DataProto.DisciplinesData.decode(proto));
    expect(decoded).toEqual(sample);
  });

  it("encodes the faculty link as a 1-based ref (0/absent = unknown)", () => {
    const proto = toProtoDisciplinesData(sample);
    const byCode = new Map(proto.disciplines.map((d) => [d.code, d]));
    // engineering is index 0 → ref 1; arts is index 1 → ref 2.
    expect(byCode.get("CSI")?.facultyRef).toBe(1);
    expect(byCode.get("ENG")?.facultyRef).toBe(2);
    // No faculty → no ref emitted.
    expect(byCode.get("MRP")?.facultyRef ?? 0).toBe(0);
  });
});

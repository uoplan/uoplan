import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { fromProtoCatalogue, reconstructProgramsForYear } from "@uoplan/core/dataTypes";
import type { Program } from "@uoplan/core/dataTypes";
import { mapCatalogue } from "./catalogue.ts";
import type { CatalogueJsonInput } from "./catalogue.ts";
import {
  buildProgramHistory,
  buildUnionCatalogueInput,
  programsOnlyInput,
} from "./catalogue-merged.ts";
import { CATALOGUE_DATA_DIR } from "../shared/paths.ts";

interface YearInput {
  year: number;
  data: CatalogueJsonInput;
}

/** Encode → decode so the test exercises the exact on-wire representation. */
function roundTripUnion(input: CatalogueJsonInput): DataProto.Catalogue {
  return DataProto.Catalogue.decode(DataProto.Catalogue.encode(mapCatalogue(input)).finish());
}

function roundTripHistory(
  yearInputs: readonly YearInput[],
  unionInput: CatalogueJsonInput,
  unionCourseCodes: readonly string[],
): DataProto.CatalogueProgramHistory {
  const built = buildProgramHistory(yearInputs, unionInput, unionCourseCodes);
  return DataProto.CatalogueProgramHistory.decode(
    DataProto.CatalogueProgramHistory.encode(built).finish(),
  );
}

/** The CURRENT per-year programs asset, decoded to domain programs. */
function currentPerYearPrograms(data: CatalogueJsonInput): Program[] {
  const proto = DataProto.Catalogue.decode(
    DataProto.Catalogue.encode(mapCatalogue(programsOnlyInput(data))).finish(),
  );
  return fromProtoCatalogue(proto).programs;
}

/** Register one parity test per year: reconstruct(history) === current per-year asset. */
function registerReconstructionParityTests(
  yearInputs: readonly YearInput[],
  unionProto: DataProto.Catalogue,
  history: DataProto.CatalogueProgramHistory,
): void {
  for (const { year, data } of yearInputs) {
    it(`reconstructs ${year} identically to the per-year asset`, () => {
      const expected = sortedEntries(bySlug(currentPerYearPrograms(data)));
      const actual = sortedEntries(bySlug(reconstructProgramsForYear(unionProto, history, year)));
      expect(actual).toEqual(expected);
    });
  }
}

/** Programs keyed by slug; asserts no slug carries two DIFFERENT values (which
 * the overlay's per-key model could not represent losslessly). */
function bySlug(programs: Program[]): Map<string, Program> {
  const map = new Map<string, Program>();
  for (const program of programs) {
    const key = program.slug ?? "";
    const existing = map.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(program)) {
      throw new Error(`conflicting duplicate slug in source data: ${key}`);
    }
    map.set(key, program);
  }
  return map;
}

function sortedEntries(map: Map<string, Program>): [string, Program][] {
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

describe("buildProgramHistory / reconstructProgramsForYear (synthetic)", () => {
  const YEARS: YearInput[] = [
    {
      year: 2020,
      data: {
        programs: [
          // stable across all years, baseline value
          { slug: "stable", title: "Stable", requirements: [{ type: "course", code: "csi1000" }] },
          // drifts in 2022
          { slug: "drift", title: "Drift", requirements: [{ type: "course", code: "mat1000" }] },
          // absent in 2022 (dropped then re-added? here: absent 2022)
          { slug: "gap", title: "Gap", requirements: [{ type: "course", code: "phy1000" }] },
          // history-only: never present in the latest (2022) year
          { slug: "gone", title: "Gone", requirements: [{ type: "course", code: "bio1000" }] },
        ],
      },
    },
    {
      year: 2021,
      data: {
        programs: [
          { slug: "stable", title: "Stable", requirements: [{ type: "course", code: "csi1000" }] },
          { slug: "drift", title: "Drift", requirements: [{ type: "course", code: "mat1000" }] },
          { slug: "gap", title: "Gap", requirements: [{ type: "course", code: "phy1000" }] },
        ],
      },
    },
    {
      year: 2022,
      data: {
        programs: [
          { slug: "stable", title: "Stable", requirements: [{ type: "course", code: "csi1000" }] },
          // drift: different requirement in latest → this is the baseline
          { slug: "drift", title: "Drift", requirements: [{ type: "course", code: "mat2000" }] },
          // gap absent in 2022
          // new-in-latest program
          { slug: "fresh", title: "Fresh", requirements: [{ type: "course", code: "eng1000" }] },
        ],
      },
    },
  ];

  const unionInput = buildUnionCatalogueInput(YEARS.map((y) => ({ year: y.year, data: y.data })));
  const unionProto = roundTripUnion(unionInput);
  const history = roundTripHistory(YEARS, unionInput, unionProto.courseCodes);

  registerReconstructionParityTests(YEARS, unionProto, history);

  it("fully-stable programs produce no overlay entry", () => {
    expect(history.overlays.some((o) => o.programKey === "stable")).toBe(false);
  });

  it("history-only programs are absent from the latest year", () => {
    const latest = reconstructProgramsForYear(unionProto, history, 2022);
    expect(latest.some((p) => p.slug === "gone")).toBe(false);
    expect(latest.some((p) => p.slug === "fresh")).toBe(true);
  });
});

const yearFiles = fs.existsSync(CATALOGUE_DATA_DIR)
  ? fs
      .readdirSync(CATALOGUE_DATA_DIR)
      .map((f) => /^catalogue\.(\d{4})\.json$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ year: Number(m[1]), file: m[0] }))
      .sort((a, b) => a.year - b.year)
  : [];

describe.skipIf(yearFiles.length === 0)(
  "program-history parity on committed catalogue data",
  () => {
    const yearInputs: YearInput[] = yearFiles.map(({ year, file }) => ({
      year,
      data: JSON.parse(
        fs.readFileSync(path.join(CATALOGUE_DATA_DIR, file), "utf8"),
      ) as CatalogueJsonInput,
    }));
    const unionInput = buildUnionCatalogueInput(yearInputs);
    const unionProto = roundTripUnion(unionInput);
    const history = roundTripHistory(yearInputs, unionInput, unionProto.courseCodes);

    registerReconstructionParityTests(yearInputs, unionProto, history);
  },
);

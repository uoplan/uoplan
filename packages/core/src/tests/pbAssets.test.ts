import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
} from "../dataTypes";
import * as DataProto from "@uoplan/proto/data";

/**
 * Contract / golden tests for committed runtime `.pb` assets.
 *
 * These guard the proto wire contract: every committed protobuf asset in
 * `apps/web/src/assets/data` must decode with the currently generated TypeScript
 * codecs AND round-trip through the domain converters without throwing. Any
 * proto schema change that breaks an existing committed asset (e.g. reusing a
 * field number, renumbering an enum) will fail here.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "..", "apps", "web", "src", "assets", "data");

function read(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(dataDir, name)));
}

function listPb(): string[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir).filter((f) => f.endsWith(".pb"));
}

describe("committed .pb assets decode with current proto contract", () => {
  it("has the expected data directory", () => {
    expect(existsSync(dataDir)).toBe(true);
    expect(listPb().length).toBeGreaterThan(0);
  });

  it("decodes catalogue manifest", () => {
    const manifest = fromProtoCatalogueManifest(
      DataProto.CatalogueManifest.decode(read("catalogue.pb")),
    );
    expect(manifest.years.length).toBeGreaterThan(0);
  });

  it("decodes terms", () => {
    const terms = fromProtoTermsData(DataProto.TermsData.decode(read("terms.pb")));
    expect(terms.terms.length).toBeGreaterThan(0);
  });

  it("decodes indices when present", () => {
    if (!existsSync(join(dataDir, "indices.pb"))) return;
    const indices = fromProtoIndices(DataProto.Indices.decode(read("indices.pb")));
    expect(indices.courses.length).toBeGreaterThan(0);
  });

  it("decodes ratemyprofessors when present", () => {
    if (!existsSync(join(dataDir, "ratemyprofessors.pb"))) return;
    const rmp = fromProtoRateMyProfessorsData(
      DataProto.RateMyProfessorsData.decode(read("ratemyprofessors.pb")),
    );
    expect(rmp.professors.length).toBeGreaterThan(0);
  });

  it("decodes disciplines when present", () => {
    if (!existsSync(join(dataDir, "disciplines.pb"))) return;
    const disciplines = fromProtoDisciplinesData(
      DataProto.DisciplinesData.decode(read("disciplines.pb")),
    );
    expect(disciplines.disciplines.length).toBeGreaterThan(0);
  });

  it("decodes grades when present", () => {
    if (!existsSync(join(dataDir, "grades.pb"))) return;
    const grades = fromProtoCourseGradesData(DataProto.GradesData.decode(read("grades.pb")));
    expect(grades.courses.length).toBeGreaterThan(0);
  });

  it("decodes every catalogue.YYYY.pb", () => {
    expectAllDecode(
      /^catalogue\.\d{4}\.pb$/,
      (buf) => fromProtoCatalogue(DataProto.Catalogue.decode(buf)),
      (c) => c.courses.length,
    );
  });

  it("decodes every schedules.NNNN.pb", () => {
    expectAllDecode(
      /^schedules\.\d+\.pb$/,
      (buf) => fromProtoSchedulesData(DataProto.SchedulesData.decode(buf)),
      (s) => s.schedules.length,
    );
  });
});

/**
 * Assert that every committed `.pb` file matching `pattern` decodes via `decode`
 * and yields a non-empty collection (measured by `size`).
 */
function expectAllDecode<T>(
  pattern: RegExp,
  decode: (buf: Uint8Array) => T,
  size: (decoded: T) => number,
): void {
  const files = listPb().filter((f) => pattern.test(f));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    expect(size(decode(read(file))), file).toBeGreaterThan(0);
  }
}

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
    // The faculty registry must be populated and every discipline's facultyId (when
    // present) must resolve to a registered faculty.
    expect(disciplines.faculties.length).toBeGreaterThan(0);
    const facultyIds = new Set(disciplines.faculties.map((f) => f.id));
    const linked = disciplines.disciplines.filter((d) => d.facultyId);
    expect(linked.length).toBeGreaterThan(0);
    expect(linked.every((d) => facultyIds.has(d.facultyId!))).toBe(true);
  });

  it("decodes grades when present", () => {
    if (!existsSync(join(dataDir, "grades.pb"))) return;
    const grades = fromProtoCourseGradesData(DataProto.GradesData.decode(read("grades.pb")));
    expect(grades.courses.length).toBeGreaterThan(0);
    // The name dictionary must resolve: at least one offering has a non-empty
    // professor name reconstructed from `section_names` + `name_refs`.
    const hasNamedOffering = grades.courses.some((c) => c.sections.some((p) => p.name?.length));
    expect(hasNamedOffering).toBe(true);
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

  it("resolves the meeting-date dictionary for schedules", () => {
    const files = listPb().filter((f) => /^schedules\.\d+\.pb$/.test(f));
    if (files.length === 0) return;
    // At least one section's meeting time across all terms must resolve a
    // `(start, end)` date range via the `meeting_date_ranges` dictionary +
    // `meeting_dates_ref` (some terms legitimately carry no dated meetings).
    const hasResolvedDates = files.some((f) => {
      const data = fromProtoSchedulesData(DataProto.SchedulesData.decode(read(f)));
      return data.schedules.some((s) =>
        Object.values(s.components).some((sections) =>
          sections.some((section) => section.times.some((t) => t.meetingDates != null)),
        ),
      );
    });
    expect(hasResolvedDates).toBe(true);
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

import { describe, expect, it, vi } from "vitest";
import { DataProto, normalizeCourseCode } from "@uoplan/core";
import type { Catalogue, Course } from "@uoplan/core";
import { createDataClient } from "../dataClient";
import { dataAssetIds } from "../loaders";
import {
  catalogueBytes,
  course,
  coursePrereqNode,
  encode,
  fetchFrom,
  prereqHistoryBytes,
  schedulesBytes,
  schedulesFor,
} from "./testFixtures";

function gradesBytes(): Uint8Array {
  return encode(
    DataProto.GradesData.encode({
      sectionNames: ["Alice Smith"],
      courses: [
        {
          code: "CSI 2110",
          nameRefs: [0],
          termIds: [2261],
          professorRefs: [0],
          legacyIds: [0],
          sections: [""],
          // GRADE_KEYS order: A+ A A- B+ B C+ C D+ D E F DR EIN NS NC ABS P S
          distributions: [10, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      ],
    }),
  );
}

// The union catalogue carries every course ever seen with its latest metadata.
// MAT 1300 is a discontinued course that only the 2025 cohort references — it now
// lives in the union rather than in a separate year catalogue.
const unionCatalogue: Catalogue = {
  courses: [
    course("CSI 2110", "Data Structures"),
    course("MAT 1320", "Calculus I"),
    course("MAT 1300", "Calculus I (old)"),
  ],
  programs: [],
};

// In 2025, CSI 2110 required MAT 1300; the union baseline (latest) has no
// prerequisite. `code: 0` = CSI 2110 (index 0 into the union course_codes).
const prereqHistory: DataProto.CataloguePrereqHistory = {
  years: [2025, 2026],
  overlays: [
    {
      code: 0,
      revisions: [
        { yearMask: 0b01, prerequisites: coursePrereqNode("MAT 1300"), hasPrereqText: false },
      ],
    },
  ],
};

function mergeCatalogue(
  latest: Catalogue,
  yearCourses: Course[] | null,
  _completedCourses: string[],
): Catalogue {
  const byCode = new Map(latest.courses.map((c) => [c.code, c]));
  for (const yearCourse of yearCourses ?? []) {
    byCode.set(yearCourse.code, yearCourse);
  }
  return { ...latest, courses: [...byCode.values()] };
}

function makeEffectiveTransport({
  years = [2026],
  union = unionCatalogue,
  history = prereqHistory,
  schedules = ["2261"],
  grades = new Error("grades unavailable"),
}: {
  years?: number[];
  union?: Catalogue;
  history?: DataProto.CataloguePrereqHistory;
  schedules?: string[];
  grades?: Uint8Array | Error;
} = {}): ReturnType<typeof fetchFrom> {
  const assets: Record<string, Uint8Array | Error> = {
    [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years })),
    [dataAssetIds.catalogueUnion]: catalogueBytes(union),
    [dataAssetIds.cataloguePrereqHistory]: prereqHistoryBytes(history),
    [dataAssetIds.grades]: grades,
  };
  for (const termId of schedules) {
    assets[dataAssetIds.schedules(termId)] = schedulesBytes(schedulesFor(termId));
  }
  return fetchFrom(assets);
}

describe("createDataClient.loadEffectiveDataset", () => {
  it("decodes manifest/union/schedules/grades, reconstructs cohort prereqs, and builds lookup caches", async () => {
    const transport = makeEffectiveTransport({ years: [2026, 2025], grades: gradesBytes() });
    const merge = vi.fn(mergeCatalogue);
    const client = createDataClient({ transport, mergeCatalogue: merge });

    const dataset = await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: 2025,
      completedCourses: ["opt1000", "CSI2110"],
    });
    const cache = await client.loadEffectiveCache({
      termId: "2261",
      firstYear: 2025,
      completedCourses: ["opt1000", "CSI2110"],
    });

    expect(cache).toBe(dataset.cache);
    expect(merge).toHaveBeenCalledOnce();
    // Base = the full union of courses (latest metadata).
    expect(merge.mock.calls[0][0].courses.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1320"),
      normalizeCourseCode("MAT 1300"),
    ]);
    // Cohort courses = the union reconstructed for 2025 (same codes, 2025 prereqs).
    const yearCourses = merge.mock.calls[0][1];
    expect(yearCourses?.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1320"),
      normalizeCourseCode("MAT 1300"),
    ]);
    expect(
      yearCourses?.find((c) => c.code === normalizeCourseCode("CSI 2110"))?.prerequisites,
    ).toMatchObject({
      type: "course",
      code: normalizeCourseCode("MAT 1300"),
    });
    expect(merge.mock.calls[0][2]).toEqual(["opt1000", "CSI2110"]);
    expect(dataset.catalogue.courses.map((c) => c.code)).toContain(normalizeCourseCode("MAT 1300"));
    expect(dataset.cache.getCourse("OPT1000")).toMatchObject({
      code: normalizeCourseCode("OPT1000"),
      title: normalizeCourseCode("OPT1000"),
      credits: 3,
    });
    expect(dataset.cache.getCourse("mat1300")?.title).toBe("Calculus I (old)");
    expect(dataset.cache.getSchedule("csi2110")?.components.LEC[0].section).toBe("A00");
    expect(dataset.schedulesData.schedules[0].components.LEC[0].distribution).toEqual(
      expect.objectContaining({ "A+": 10, B: 2 }),
    );
    expect(transport).toHaveBeenCalledWith("catalogue.pb");
    expect(transport).toHaveBeenCalledWith("catalogue.union.pb");
    expect(transport).toHaveBeenCalledWith("catalogue.history.pb");
    expect(transport).toHaveBeenCalledWith("schedules.2261.pb");
    expect(transport).toHaveBeenCalledWith("grades.pb");
    expect(transport).not.toHaveBeenCalledWith("catalogue.2026.pb");
  });

  it("skips the prereq history when the first year equals the manifest latest year", async () => {
    const transport = makeEffectiveTransport();
    const merge = vi.fn(mergeCatalogue);
    const client = createDataClient({ transport, mergeCatalogue: merge });

    await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: 2026,
      completedCourses: [],
    });

    expect(transport.mock.calls.filter(([id]) => id === "catalogue.union.pb")).toHaveLength(1);
    expect(transport).not.toHaveBeenCalledWith("catalogue.history.pb");
    expect(merge.mock.calls[0][1]).toBeNull();
  });

  it("treats grades as optional and leaves schedules unmodified when grades fail to load", async () => {
    const transport = makeEffectiveTransport({ grades: new Error("not published yet") });
    const client = createDataClient({ transport, mergeCatalogue });

    const dataset = await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: null,
      completedCourses: [],
    });

    expect(dataset.schedulesData.schedules[0].components.LEC[0].distribution).toBeUndefined();
    expect(dataset.cache.getCourse("CSI2110")?.title).toBe("Data Structures");
  });

  it("rejects an empty catalogue manifest instead of guessing a catalogue year", async () => {
    const transport = fetchFrom({
      [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years: [] })),
    });
    const client = createDataClient({ transport });

    await expect(
      client.loadEffectiveDataset({ termId: "2261", firstYear: null, completedCourses: [] }),
    ).rejects.toThrow("Catalogue manifest has no years");
    expect(transport).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledWith("catalogue.pb");
  });

  it("evicts the least-recently-used effective dataset when the cache is full", async () => {
    const transport = makeEffectiveTransport({ schedules: ["2261", "2265"] });
    const merge = vi.fn(mergeCatalogue);
    const client = createDataClient({ transport, mergeCatalogue: merge, cacheSize: 1 });

    const first = await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: null,
      completedCourses: [],
    });
    await client.loadEffectiveDataset({ termId: "2265", firstYear: null, completedCourses: [] });
    const reloaded = await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: null,
      completedCourses: [],
    });

    expect(reloaded).not.toBe(first);
    expect(merge).toHaveBeenCalledTimes(3);
  });
});

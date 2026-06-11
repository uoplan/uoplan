import { describe, expect, it, vi } from "vitest";
import { DataProto, normalizeCourseCode } from "@uoplan/core";
import type { Catalogue, Course } from "@uoplan/core";
import { createDataClient } from "../dataClient";
import { dataAssetIds } from "../loaders";
import {
  catalogueBytes,
  course,
  encode,
  fetchFrom,
  schedulesBytes,
  schedulesFor,
} from "./testFixtures";

function gradesBytes(): Uint8Array {
  return encode(
    DataProto.GradesData.encode({
      courses: [
        {
          code: "CSI 2110",
          professors: [
            {
              name: "Alice Smith",
              termId: 2261,
              distribution: {
                aPlus: 10,
                a: 0,
                aMinus: 0,
                bPlus: 0,
                b: 2,
                cPlus: 0,
                c: 0,
                dPlus: 0,
                d: 0,
                e: 0,
                f: 0,
                ein: 0,
                ns: 0,
                nc: 0,
                abs: 0,
                p: 0,
                s: 0,
              },
            },
          ],
        },
      ],
    }),
  );
}

const latestCatalogue: Catalogue = {
  courses: [course("CSI 2110", "Data Structures"), course("MAT 1320", "Calculus I")],
  programs: [],
};

const firstYearCatalogue: Catalogue = {
  courses: [course("CSI 2110", "Old Data Structures"), course("MAT 1300", "Calculus I (old)")],
  programs: [],
};

function mergeCatalogue(
  latest: Catalogue,
  yearCourses: Course[] | null,
  _completedCourses: string[],
): Catalogue {
  const byCode = new Map(latest.courses.map((c) => [c.code, c]));
  for (const yearCourse of yearCourses ?? []) {
    if (!byCode.has(yearCourse.code)) byCode.set(yearCourse.code, yearCourse);
  }
  return { ...latest, courses: [...byCode.values()] };
}

function makeEffectiveTransport({
  years = [2026],
  catalogues = [[2026, latestCatalogue]],
  schedules = ["2261"],
  grades = new Error("grades unavailable"),
}: {
  years?: number[];
  catalogues?: Array<readonly [year: number, catalogue: Catalogue]>;
  schedules?: string[];
  grades?: Uint8Array | Error;
} = {}): ReturnType<typeof fetchFrom> {
  const assets: Record<string, Uint8Array | Error> = {
    [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years })),
    [dataAssetIds.grades]: grades,
  };
  for (const [year, catalogue] of catalogues) {
    assets[dataAssetIds.catalogue(year)] = catalogueBytes(catalogue);
  }
  for (const termId of schedules) {
    assets[dataAssetIds.schedules(termId)] = schedulesBytes(schedulesFor(termId));
  }
  return fetchFrom(assets);
}

describe("createDataClient.loadEffectiveDataset", () => {
  it("decodes manifest/catalogue/schedules/grades, merges the effective catalogue, and builds lookup caches", async () => {
    const transport = fetchFrom({
      [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years: [2026, 2025] })),
      [dataAssetIds.catalogue(2026)]: catalogueBytes(latestCatalogue),
      [dataAssetIds.catalogue(2025)]: catalogueBytes(firstYearCatalogue),
      [dataAssetIds.schedules("2261")]: schedulesBytes(schedulesFor("2261")),
      [dataAssetIds.grades]: gradesBytes(),
    });
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
    expect(merge.mock.calls[0][0].courses.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1320"),
    ]);
    expect(merge.mock.calls[0][1]?.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1300"),
    ]);
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
    expect(transport).toHaveBeenCalledWith("catalogue.2026.pb");
    expect(transport).toHaveBeenCalledWith("catalogue.2025.pb");
    expect(transport).toHaveBeenCalledWith("schedules.2261.pb");
    expect(transport).toHaveBeenCalledWith("grades.pb");
  });

  it("reuses the decoded latest catalogue when first year equals the manifest latest year", async () => {
    const transport = makeEffectiveTransport();
    const merge = vi.fn(mergeCatalogue);
    const client = createDataClient({ transport, mergeCatalogue: merge });

    await client.loadEffectiveDataset({
      termId: "2261",
      firstYear: 2026,
      completedCourses: [],
    });

    expect(transport.mock.calls.filter(([id]) => id === "catalogue.2026.pb")).toHaveLength(1);
    expect(transport).not.toHaveBeenCalledWith("catalogue.2025.pb");
    expect(merge.mock.calls[0][1]?.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1320"),
    ]);
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

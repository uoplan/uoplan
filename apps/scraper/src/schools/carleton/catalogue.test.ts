import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { carletonArchiveYearSlug, scrapeCarletonCatalogueCli } from "./catalogue.ts";

// ---------------------------------------------------------------------------
// carletonArchiveYearSlug
// ---------------------------------------------------------------------------

describe("carletonArchiveYearSlug", () => {
  it("returns null for years 2011 and earlier (legacy www3.carleton.ca system)", () => {
    for (const year of [2004, 2005, 2010, 2011]) {
      expect(carletonArchiveYearSlug(year)).toBeNull();
    }
  });

  it("returns 2-digit suffix '2012-13' for 2012", () => {
    expect(carletonArchiveYearSlug(2012)).toBe("2012-13");
  });

  it("returns 2-digit suffix '2013-14' for 2013", () => {
    expect(carletonArchiveYearSlug(2013)).toBe("2013-14");
  });

  it("returns full 4-digit suffix for 2014 and later", () => {
    expect(carletonArchiveYearSlug(2014)).toBe("2014-2015");
    expect(carletonArchiveYearSlug(2020)).toBe("2020-2021");
    expect(carletonArchiveYearSlug(2025)).toBe("2025-2026");
  });
});

// ---------------------------------------------------------------------------
// Empty-scrape guard: a year with 0 courses must NOT produce a catalogue file
// ---------------------------------------------------------------------------

// Track what gets written.
const writtenFiles: string[] = [];

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn(async (_p: string) => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async () => ["catalogue.2025.json"]),
    readFile: vi.fn(async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    writeFile: vi.fn(async (filePath: string, _data: string | Uint8Array) => {
      writtenFiles.push(filePath);
    }),
    copyFile: vi.fn(async () => {}),
  },
}));

vi.mock("./calendar/scrapeCatalogue.ts", () => ({
  scrapeCarletonCatalogue: vi.fn(async () => ({
    catalogue: { courses: [], programs: [] },
    report: { misses: [] },
  })),
}));

vi.mock("../../catalogue/indices.ts", () => ({
  generateIndices: vi.fn(async () => {}),
  parseCatalogueYears: vi.fn(() => [2025]),
  parseMissingByYear: vi.fn(() => ({})),
}));

vi.mock("../../catalogue/links.ts", () => ({
  getCurrentAcademicYear: vi.fn(() => 2025),
}));

vi.mock("@uoplan/domain/school", () => ({
  SCHOOLS: {
    carleton: { oldestCatalogueYear: 2025 },
  },
}));

vi.mock("../../shared/paths.ts", () => ({
  catalogueDataDir: vi.fn(() => "/fake/data/carleton/catalogue"),
}));

describe("scrapeCarletonCatalogueCli — empty scrape guard", () => {
  beforeEach(() => {
    writtenFiles.length = 0;
  });

  it("does not write a catalogue.json year file when the scrape returns 0 courses", async () => {
    await scrapeCarletonCatalogueCli(true);

    // Only the manifest (catalogue.json) and missing log (catalogue.missing.json)
    // should have been written — NOT a catalogue.<year>.json file.
    const catalogueYearFiles = writtenFiles.filter((f) =>
      /catalogue\.\d{4}\.json$/.test(path.basename(f)),
    );
    expect(catalogueYearFiles).toHaveLength(0);
  });
});

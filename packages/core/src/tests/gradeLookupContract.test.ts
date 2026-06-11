import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as DataProto from "@uoplan/proto/data";
import type { GradeDistribution } from "../dataTypes";
import { fromProtoCourseGradesData } from "../dataTypes";
import { buildGradeLookups, lookupSectionDistribution } from "../gradeLookup";

/**
 * Contract test: the runtime grade lookup (built from `grades.pb`) must
 * reproduce the per-section `distribution` that the build-time enricher writes
 * into the committed source `schedules.NNNN.json`. Using the source JSON as the
 * oracle keeps this contract enforceable AFTER the embedded
 * `ComponentSection.distribution` is removed from the `.pb` assets (the `.pb`
 * can no longer carry the values, but the source JSON still records the exact
 * output the scraper produced).
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "..", "apps", "web", "src", "assets", "data");
const sourceDir = join(here, "..", "..", "..", "..", "apps", "scraper", "data", "schedules");

interface SourceSection {
  times?: Array<{ instructor?: string | null }>;
  distribution?: GradeDistribution;
}
interface SourceCourse {
  courseCode?: string;
  components?: Record<string, SourceSection[]>;
}
interface SourceSchedules {
  termId?: string | number;
  schedules?: SourceCourse[];
}

function sourceScheduleFiles(): string[] {
  if (!existsSync(sourceDir)) return [];
  return readdirSync(sourceDir).filter((f) => /^schedules\.\d+\.json$/.test(f));
}

describe("runtime grade lookup reproduces scraper-enriched source distributions", () => {
  const hasGrades = existsSync(join(dataDir, "grades.pb"));
  const files = sourceScheduleFiles();

  it("has grades + source schedule JSON to compare", () => {
    expect(hasGrades).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  if (!hasGrades) return;

  const lookups = buildGradeLookups(
    fromProtoCourseGradesData(
      DataProto.GradesData.decode(new Uint8Array(readFileSync(join(dataDir, "grades.pb")))),
    ),
  );

  it("matches source-JSON distributions for every section across all schedule files", () => {
    let withEmbedded = 0;
    const mismatches: string[] = [];

    for (const file of files) {
      const termId = Number.parseInt(file.replace(/^schedules\.(\d+)\.json$/, "$1"), 10);
      const data = JSON.parse(readFileSync(join(sourceDir, file), "utf8")) as SourceSchedules;

      for (const course of data.schedules ?? []) {
        const courseCode = course.courseCode;
        if (typeof courseCode !== "string") continue;
        for (const sections of Object.values(course.components ?? {})) {
          for (const section of sections) {
            const instructors = (section.times ?? []).map((t) => t.instructor ?? undefined);
            const res = lookupSectionDistribution(lookups, courseCode, termId, instructors);

            if (section.distribution) {
              withEmbedded += 1;
              if (
                (res.kind === "none" ||
                  JSON.stringify(res.distribution) !== JSON.stringify(section.distribution)) &&
                mismatches.length < 10
              ) {
                mismatches.push(
                  `${file} ${courseCode}: ` +
                    `source=${JSON.stringify(section.distribution)} lookup=${JSON.stringify(res.distribution)} (${res.kind})`,
                );
              }
            } else {
              // No source distribution => enricher found none => lookup must agree.
              expect(res.kind, `${file} ${courseCode}`).toBe("none");
            }
          }
        }
      }
    }

    expect(withEmbedded).toBeGreaterThan(0);
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
});

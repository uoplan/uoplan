/**
 * Grades scraper orchestration.
 *
 * Pipeline: aggregate raw grade CSVs (`data/raw/*.csv`, generated from the
 * registrar Excel exports in `raw/xlsx/` by `pnpm --filter scraper grades:convert`)
 * -> attach professor(s) to
 * each `(termId, code, section)` from the feedback datasets -> resolve each
 * feedback professor to a RateMyProfessors professor (canonical name + legacyId)
 * -> group by course code over the full catalogue. The result matches the shape
 * of the committed `grades.json` and replaces it.
 */

import fs from "node:fs/promises";
import type { SchoolId } from "@uoplan/domain/school";
import { assertSchoolFeature } from "../shared/schoolFeatures.ts";
import { gradesFile, rawDataDir } from "../shared/paths.ts";
import { readCatalogueCodes } from "./catalogue.ts";
import { readGradeRows } from "./csv.ts";
import type { GradeRow } from "./csv.ts";
import { orderDistribution } from "./distribution.ts";
import type { Distribution } from "./distribution.ts";
import { buildFeedbackProfIndex, feedbackKey } from "./feedbackProfs.ts";
import { buildProfessorResolver } from "./rmp.ts";
import type { ProfessorResolver } from "./rmp.ts";

interface SectionGrades {
  name?: string;
  legacyId?: number;
  termId: number;
  section: string;
  distribution: Distribution;
}

interface CourseGrades {
  code: string;
  sections: SectionGrades[];
}

interface BuildStats {
  codes: number;
  codesWithProfessors: number;
  sectionEntries: number;
  rowsWithoutFeedbackMatch: number;
  professorsWithoutLegacyId: number;
}

interface BuildResult {
  output: CourseGrades[];
  stats: BuildStats;
}

function compareSections(a: SectionGrades, b: SectionGrades): number {
  return (
    (a.name ?? "").localeCompare(b.name ?? "") ||
    a.termId - b.termId ||
    a.section.localeCompare(b.section)
  );
}

/**
 * Pure assembly step (no I/O) so it can be unit-tested with in-memory fixtures.
 */
export function assembleGrades(
  rows: GradeRow[],
  feedbackIndex: Map<string, string[]>,
  resolveProfessor: ProfessorResolver,
  catalogueCodes: Iterable<string>,
): BuildResult {
  const byCode = new Map<string, SectionGrades[]>();
  const codes = new Set<string>(catalogueCodes);

  let rowsWithoutFeedbackMatch = 0;
  let professorsWithoutLegacyId = 0;

  for (const row of rows) {
    codes.add(row.code);
    const names = feedbackIndex.get(feedbackKey(row.termId, row.code, row.section));
    const distribution = orderDistribution(row.distribution);
    const list = byCode.get(row.code) ?? [];
    if (!names || names.length === 0) {
      rowsWithoutFeedbackMatch++;
      list.push({
        termId: row.termId,
        section: row.section,
        distribution,
      });
      byCode.set(row.code, list);
      continue;
    }

    // Dedupe by resolved name within a section so multiple feedback names that
    // resolve to the same professor don't produce duplicate entries.
    const seen = new Set<string>();
    for (const feedbackName of names) {
      const { name, legacyId } = resolveProfessor(feedbackName);
      if (seen.has(name)) continue;
      seen.add(name);
      if (legacyId === undefined) professorsWithoutLegacyId++;
      list.push({
        name,
        ...(legacyId !== undefined ? { legacyId } : {}),
        termId: row.termId,
        section: row.section,
        distribution,
      });
    }
    byCode.set(row.code, list);
  }

  const output: CourseGrades[] = [...codes]
    .sort((a, b) => a.localeCompare(b))
    .map((code) => {
      const sections = (byCode.get(code) ?? []).sort(compareSections);
      return { code, sections };
    });

  let sectionEntries = 0;
  let codesWithProfessors = 0;
  for (const course of output) {
    if (course.sections.length > 0) {
      codesWithProfessors++;
      sectionEntries += course.sections.length;
    }
  }

  return {
    output,
    stats: {
      codes: output.length,
      codesWithProfessors,
      sectionEntries,
      rowsWithoutFeedbackMatch,
      professorsWithoutLegacyId,
    },
  };
}

async function buildGrades(school: SchoolId): Promise<BuildResult> {
  const rows = await readGradeRows(rawDataDir(school));
  const termIds = rows.map((r) => r.termId);
  const [feedbackIndex, resolveProfessor, catalogueCodes] = await Promise.all([
    buildFeedbackProfIndex(termIds, school),
    buildProfessorResolver(school),
    readCatalogueCodes(school),
  ]);
  return assembleGrades(rows, feedbackIndex, resolveProfessor, catalogueCodes);
}

export async function runBuild(school: SchoolId): Promise<void> {
  assertSchoolFeature(
    school,
    "grades",
    "Carleton has no public grade data; grades are uOttawa-only.",
  );
  const { output, stats } = await buildGrades(school);
  const outputFile = gradesFile(school);
  await fs.writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${outputFile}`);
  console.log(`  codes: ${stats.codes} (${stats.codesWithProfessors} with professors)`);
  console.log(`  section entries: ${stats.sectionEntries}`);
  console.log(`  rows without a feedback professor match: ${stats.rowsWithoutFeedbackMatch}`);
  console.log(`  professor entries without a legacyId: ${stats.professorsWithoutLegacyId}`);
}

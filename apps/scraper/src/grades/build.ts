/**
 * Grades scraper orchestration.
 *
 * Pipeline: aggregate raw grade CSVs (`data/raw/*.csv`) -> attach professor(s) to
 * each `(termId, code, section)` from the feedback datasets -> resolve each
 * feedback professor to a RateMyProfessors professor (canonical name + legacyId)
 * -> group by course code over the full catalogue. The result matches the shape
 * of the committed `grades.json` and replaces it.
 */

import fs from "node:fs/promises";
import { GRADES_FILE, RAW_DATA_DIR } from "../shared/paths.ts";
import { readCatalogueCodes } from "./catalogue.ts";
import { readGradeRows, type GradeRow } from "./csv.ts";
import { type Distribution, orderDistribution } from "./distribution.ts";
import { buildFeedbackProfIndex, feedbackKey } from "./feedbackProfs.ts";
import { buildProfessorResolver, type ProfessorResolver } from "./rmp.ts";

export interface ProfessorGrades {
  name: string;
  legacyId?: number;
  termId: number;
  section: string;
  distribution: Distribution;
}

export interface CourseGrades {
  code: string;
  professors: ProfessorGrades[];
}

export interface BuildStats {
  codes: number;
  codesWithProfessors: number;
  professorEntries: number;
  rowsWithoutFeedbackMatch: number;
  professorsWithoutLegacyId: number;
}

export interface BuildResult {
  output: CourseGrades[];
  stats: BuildStats;
}

function compareProfessors(a: ProfessorGrades, b: ProfessorGrades): number {
  return a.name.localeCompare(b.name) || a.termId - b.termId || a.section.localeCompare(b.section);
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
  const byCode = new Map<string, ProfessorGrades[]>();
  const codes = new Set<string>(catalogueCodes);

  let rowsWithoutFeedbackMatch = 0;
  let professorsWithoutLegacyId = 0;

  for (const row of rows) {
    codes.add(row.code);
    const names = feedbackIndex.get(feedbackKey(row.termId, row.code, row.section));
    if (!names || names.length === 0) {
      rowsWithoutFeedbackMatch++;
      continue;
    }

    const distribution = orderDistribution(row.distribution);
    const list = byCode.get(row.code) ?? [];
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
      const professors = (byCode.get(code) ?? []).sort(compareProfessors);
      return { code, professors };
    });

  let professorEntries = 0;
  let codesWithProfessors = 0;
  for (const course of output) {
    if (course.professors.length > 0) {
      codesWithProfessors++;
      professorEntries += course.professors.length;
    }
  }

  return {
    output,
    stats: {
      codes: output.length,
      codesWithProfessors,
      professorEntries,
      rowsWithoutFeedbackMatch,
      professorsWithoutLegacyId,
    },
  };
}

export async function buildGrades(): Promise<BuildResult> {
  const rows = await readGradeRows(RAW_DATA_DIR);
  const termIds = rows.map((r) => r.termId);
  const [feedbackIndex, resolveProfessor, catalogueCodes] = await Promise.all([
    buildFeedbackProfIndex(termIds),
    buildProfessorResolver(),
    readCatalogueCodes(),
  ]);
  return assembleGrades(rows, feedbackIndex, resolveProfessor, catalogueCodes);
}

export async function runBuild(): Promise<void> {
  const { output, stats } = await buildGrades();
  await fs.writeFile(GRADES_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${GRADES_FILE}`);
  console.log(`  codes: ${stats.codes} (${stats.codesWithProfessors} with professors)`);
  console.log(`  professor entries: ${stats.professorEntries}`);
  console.log(`  rows without a feedback professor match: ${stats.rowsWithoutFeedbackMatch}`);
  console.log(`  professor entries without a legacyId: ${stats.professorsWithoutLegacyId}`);
}

/**
 * Build the `(termId, code, section) -> professor name` index used to attach
 * professors to grade rows.
 *
 * Source of truth is the committed feedback dataset
 * `apps/scraper/data/<school>/feedback/feedback.<STRM>.json`, whose section titles carry
 * the first-party prof <-> section <-> course join. Files are large (~40 MB), so
 * they are loaded one term at a time and released before moving on.
 */

import path from "node:path";
import type { SchoolId } from "@uoplan/domain/school";
import { readJson } from "../shared/json.ts";
import { feedbackDataDir } from "../shared/paths.ts";
import { normalizeCode } from "./distribution.ts";

interface FeedbackSection {
  section: string;
  professor: string;
}

interface FeedbackCourse {
  code: string;
  sections: FeedbackSection[];
}

type FeedbackFile = FeedbackCourse[];

export function feedbackKey(termId: number, code: string, section: string): string {
  return `${termId}|${normalizeCode(code)}|${section.trim().toUpperCase()}`;
}

/**
 * Load the feedback datasets for the given terms and return a map from
 * `feedbackKey(...)` to the list of distinct professor display names for that
 * `(termId, code, section)`. Team-taught sections list multiple professors;
 * all of them are kept (deduplicated, in first-seen order) so every professor
 * association is preserved.
 *
 * Missing per-term feedback files are skipped (a term may legitimately have no
 * feedback dataset); any other read/parse error is propagated.
 */
export async function buildFeedbackProfIndex(
  termIds: Iterable<number>,
  school: SchoolId,
): Promise<Map<string, string[]>> {
  const feedbackDir = feedbackDataDir(school);
  const index = new Map<string, string[]>();
  const unique = [...new Set(termIds)].sort((a, b) => a - b);

  for (const termId of unique) {
    const file = path.join(feedbackDir, `feedback.${termId}.json`);
    let data: FeedbackFile;
    try {
      data = await readJson<FeedbackFile>(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw err;
    }

    for (const course of data) {
      if (!course?.code || !Array.isArray(course.sections)) continue;
      for (const section of course.sections) {
        const professor = section?.professor?.trim();
        if (!professor || !section.section) continue;
        const key = feedbackKey(termId, course.code, section.section);
        const names = index.get(key);
        if (names) {
          if (!names.includes(professor)) names.push(professor);
        } else {
          index.set(key, [professor]);
        }
      }
    }
  }

  return index;
}

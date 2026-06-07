/* eslint-disable */
import fs from "node:fs/promises";
import path from "node:path";
import * as FeedbackProto from "@uoplan/proto/feedback";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { readJson } from "../shared/json.ts";

interface JsonOption {
  label: string;
  count: number | null;
  percentage: number | null;
}

interface JsonQuestion {
  question: string;
  chartUrl: string | null;
  registeredStudents: number | null;
  responses: number | null;
  average: number | null;
  standardDeviation: number | null;
  options: JsonOption[];
}

interface JsonSection {
  section: string;
  professor: string;
  title?: string;
  questions?: JsonQuestion[];
}

interface JsonCourse {
  code: string;
  sections: JsonSection[];
}

/** Stable string-dictionary with index lookup. */
class Dict {
  private readonly index = new Map<string, number>();
  readonly values: string[] = [];
  intern(value: string): number {
    let i = this.index.get(value);
    if (i === undefined) {
      i = this.values.length;
      this.index.set(value, i);
      this.values.push(value);
    }
    return i;
  }
}

function feedbackJsonFiles(entries: string[]): string[] {
  return entries
    .filter((name) => /^feedback\.\d+\.json$/.test(name))
    .sort(
      (a, b) => Number.parseInt(a.match(/\d+/)![0], 10) - Number.parseInt(b.match(/\d+/)![0], 10),
    );
}

/**
 * Combine every `feedback.<termId>.json` into a single `FeedbackData` message.
 * Questions, option labels and professor names are interned into head
 * dictionaries; course codes are referenced against the shared `indices.pb` list
 * (with a small `extraCourses` overflow for historical codes). Sections are
 * stored column-wise (parallel packed arrays) to avoid per-result framing.
 *
 * Returns `null` when no feedback datasets are present (so callers can skip).
 */
export async function buildFeedbackData(): Promise<FeedbackProto.FeedbackData | null> {
  const entries = await fs.readdir(SCRAPER_DATA_DIR);
  const files = feedbackJsonFiles(entries);
  if (files.length === 0) return null;

  const terms: Array<{ termId: number; courses: JsonCourse[] }> = [];
  for (const file of files) {
    const termId = Number.parseInt(file.match(/\d+/)![0], 10);
    const courses = await readJson<JsonCourse[]>(path.join(SCRAPER_DATA_DIR, file));
    terms.push({ termId, courses });
  }

  // Pass 1: discover the option set each question is associated with. Each
  // question text maps to a single option-label signature (verified across the
  // corpus); the first observed distribution wins.
  const optionSetDict = new Map<string, number>();
  const optionSets: string[][] = [];
  const internOptionSet = (labels: string[]): number => {
    const key = labels.join("\u0000");
    let i = optionSetDict.get(key);
    if (i === undefined) {
      i = optionSets.length;
      optionSetDict.set(key, i);
      optionSets.push(labels);
    }
    return i;
  };

  const questionDict = new Map<string, number>();
  const questionTexts: string[] = [];
  const questionOptionSet: Array<number | undefined> = [];
  const internQuestion = (text: string, optionSetIdx: number | undefined): number => {
    let i = questionDict.get(text);
    if (i === undefined) {
      i = questionTexts.length;
      questionDict.set(text, i);
      questionTexts.push(text);
      questionOptionSet.push(optionSetIdx);
    } else if (questionOptionSet[i] === undefined && optionSetIdx !== undefined) {
      questionOptionSet[i] = optionSetIdx;
    }
    return i;
  };

  // Resolve course codes against the shared `indices.pb` course list so their
  // strings are not duplicated here; codes absent from it go into `extraCourses`
  // and are addressed by `indicesCourseCount + extraIndex`.
  const normalizeCode = (value: string): string => value.trim().replace(/\s+/g, " ");
  const indices = await readJson<{ courses?: string[] }>(
    path.join(SCRAPER_DATA_DIR, "indices.json"),
  );
  const indicesCourses = indices.courses ?? [];
  const indicesCourseCount = indicesCourses.length;
  const globalCourseIndex = new Map<string, number>();
  indicesCourses.forEach((code, i) => globalCourseIndex.set(normalizeCode(code), i));
  const extraCourses = new Dict();
  const resolveCourse = (code: string): number => {
    const normalized = normalizeCode(code);
    const global = globalCourseIndex.get(normalized);
    if (global !== undefined) return global;
    return indicesCourseCount + extraCourses.intern(normalized);
  };

  const professors = new Dict();

  // Distinct ordered question sequences, referenced per-section by index.
  const questionSetDict = new Map<string, number>();
  const questionSets: number[][] = [];
  const internQuestionSet = (sequence: number[]): number => {
    const key = sequence.join(",");
    let i = questionSetDict.get(key);
    if (i === undefined) {
      i = questionSets.length;
      questionSetDict.set(key, i);
      questionSets.push(sequence);
    }
    return i;
  };

  const protoTerms: FeedbackProto.FeedbackTerm[] = [];
  for (const term of terms) {
    const protoCourses: FeedbackProto.FeedbackTermCourse[] = [];
    for (const course of term.courses) {
      const sections: FeedbackProto.FeedbackSection[] = [];
      for (const section of course.sections) {
        const questions = section.questions ?? [];
        if (questions.length === 0) continue; // no openable report -> nothing to display

        // Columnar parallel arrays. `registered`/`counts`/`responses` presence is
        // uniform per section (verified): older reports carry `counts` (and the
        // per-question response total equals each count slice's sum, so
        // `responses` is dropped); modern reports carry `responses`/`registered`.
        const questionIdx: number[] = [];
        const responses: number[] = [];
        const registered: number[] = [];
        const counts: number[] = [];
        let anyRegistered = false;
        let anyCounts = false;
        for (const q of questions) {
          const hasOptions = q.options.length > 0;
          const optionSetIdx = hasOptions
            ? internOptionSet(q.options.map((o) => o.label))
            : undefined;
          questionIdx.push(internQuestion(q.question, optionSetIdx));
          responses.push(q.responses ?? 0);
          if (q.registeredStudents != null) {
            anyRegistered = true;
            registered.push(q.registeredStudents);
          } else {
            registered.push(0);
          }
          if (hasOptions) {
            anyCounts = true;
            for (const o of q.options) counts.push(o.count ?? 0);
          }
        }
        sections.push({
          section: section.section,
          professor: professors.intern(section.professor),
          questionSet: internQuestionSet(questionIdx),
          // Older reports recompute responses from `counts`, so omit them.
          responses: anyCounts ? [] : responses,
          registered: anyRegistered ? registered : [],
          counts,
        });
      }
      if (sections.length === 0) continue;
      protoCourses.push({ course: resolveCourse(course.code), sections });
    }
    protoTerms.push({ termId: term.termId, courses: protoCourses });
  }

  return {
    optionSets: optionSets.map((labels) => ({ labels })),
    questions: questionTexts.map((text, i) => ({ text, optionSet: questionOptionSet[i] })),
    professors: professors.values,
    extraCourses: extraCourses.values,
    indicesCourseCount,
    terms: protoTerms,
    questionSets: questionSets.map((questions) => ({ questions })),
  };
}

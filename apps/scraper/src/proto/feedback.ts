import fs from "node:fs/promises";
import path from "node:path";
import type * as FeedbackProto from "@uoplan/proto/feedback";
import { optionsPath } from "../feedback/cache.ts";
import { FEEDBACK_DATA_DIR, SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { readJson } from "../shared/json.ts";
import type { ProfessorResolver } from "../professors/buildRegistry.ts";

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

// Older reports whose distribution can be reduced to a 1-5 mean. A question whose
// non-N/A options match one of these signatures (verbatim) gets a computed
// average; everything else is categorical and unscored.
const OLD_SCALE_SIGNATURES: string[][] = [
  ["almost always", "often", "sometimes", "rarely", "almost never"],
  ["strongly agree", "agree", "disagree", "strongly disagree"],
  ["very useful", "useful", "not very useful", "useless"],
  ["excellent", "good", "acceptable", "poor", "very poor"],
  ["enhanced the learning", "had no impact on learning", "detracted from learning"],
];
const OLD_SCALE_KEYS = new Set(OLD_SCALE_SIGNATURES.map((s) => s.join("\u0000")));

// Older reports expose a per-option Likert distribution; we reduce it to a single
// 1-5 average comparable with the modern reports' reported mean. Non-answer
// options are excluded from the mean, and the remaining ordinal options are mapped
// best-first onto 5..1.
const NA_OPTION_LABELS = new Set<string>([
  "question not applicable",
  "no feedback",
  "no classroom meetings were scheduled",
]);

/**
 * Reduce an older report's per-option distribution to a 1-5 average (best-first
 * linear mapping over the non-N/A ordinal options), or `null` when the question is
 * categorical (not an ordinal quality scale).
 */
function oldEraAverage(options: JsonOption[]): number | null {
  const ordinal = options.filter((o) => !NA_OPTION_LABELS.has(o.label));
  if (ordinal.length < 2) return null;
  if (!OLD_SCALE_KEYS.has(ordinal.map((o) => o.label).join("\u0000"))) return null;
  const n = ordinal.length;
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const count = ordinal[i].count ?? 0;
    // Best-first: first option scores 5, last scores 1.
    const score = 5 - (i * 4) / (n - 1);
    weighted += count * score;
    total += count;
  }
  if (total === 0) return null;
  return weighted / total;
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
 * Question texts and professor names are interned into head dictionaries; course
 * codes are referenced against the shared `indices.pb` list (with a small
 * `extraCourses` overflow for historical codes). Sections are stored column-wise
 * (parallel packed arrays) carrying, per question, the response count, invited
 * count, and a single 1-5 average (scaled by 100) — modern reports use the
 * reported mean, older reports have it recomputed from their distribution.
 *
 * Returns `null` when no feedback datasets are present (so callers can skip).
 */
export async function buildFeedbackData(
  resolver?: ProfessorResolver,
): Promise<FeedbackProto.FeedbackData | null> {
  const entries = await fs.readdir(FEEDBACK_DATA_DIR).catch(() => [] as string[]);
  const files = feedbackJsonFiles(entries);
  if (files.length === 0) return null;

  const terms: Array<{ termId: number; courses: JsonCourse[] }> = [];
  for (const file of files) {
    const termId = Number.parseInt(file.match(/\d+/)![0], 10);
    const courses = await readJson<JsonCourse[]>(path.join(FEEDBACK_DATA_DIR, file));
    terms.push({ termId, courses });
  }

  // Per-question ordinal option labels (best-first), produced by the parse stage
  // (HTML tables / OCR'd charts) and stored once per question in this sidecar.
  const optionLabelsByText = await readJson<Record<string, string[]>>(optionsPath()).catch(
    (): Record<string, string[]> => ({}),
  );

  // Question dictionary. `scale` is set for any question that ever yields a
  // numeric average (so the client knows which questions are chartable).
  // `optionSet` records the 1-based index of the question's ordinal response
  // labels (from the sidecar; 0 = unknown).
  const questionDict = new Map<string, number>();
  const questionTexts: string[] = [];
  const questionScale: boolean[] = [];
  const questionOptionSet: number[] = [];

  // Distinct ordinal option-label sets (best-first), referenced 1-based by
  // questions. Only a handful of scales exist across the corpus.
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
    return i + 1; // 1-based; 0 means "unknown".
  };

  const internQuestion = (text: string, hasAverage: boolean): number => {
    let i = questionDict.get(text);
    if (i === undefined) {
      i = questionTexts.length;
      questionDict.set(text, i);
      questionTexts.push(text);
      questionScale.push(hasAverage);
      const labels = optionLabelsByText[text];
      questionOptionSet.push(labels && labels.length >= 2 ? internOptionSet(labels) : 0);
    } else if (hasAverage) {
      questionScale[i] = true;
    }
    return i;
  };

  // Resolve course codes against the shared `indices.pb` course list so their
  // strings are not duplicated here; codes absent from it go into `extraCourses`
  // and are addressed by `indicesCourseCount + extraIndex`.
  const normalizeCode = (value: string): string => value.trim().replaceAll(/\s+/g, " ");
  const indices = await readJson<{ courses?: string[] }>(
    path.join(SCRAPER_DATA_DIR, "indices.json"),
  );
  const indicesCourses = indices.courses ?? [];
  const indicesCourseCount = indicesCourses.length;
  const globalCourseIndex = new Map<string, number>();
  for (const [i, code] of indicesCourses.entries()) globalCourseIndex.set(normalizeCode(code), i);
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

        // Columnar parallel arrays aligned with the section's question set.
        // `responses` is the number of answers; `registered` the invited count
        // (empty when unavailable, i.e. older reports); `averages` the 1-5 mean
        // scaled by 100 (0 when the question carries no ordinal average).
        const questionIdx: number[] = [];
        const responses: number[] = [];
        const registered: number[] = [];
        const averages: number[] = [];
        let anyRegistered = false;
        for (const q of questions) {
          const hasOptions = q.options.length > 0;
          // The per-question average is the modern reports' reported mean
          // (`q.average`); older reports have no mean and instead have it
          // recomputed from their per-option distribution.
          const average = q.average ?? (hasOptions ? oldEraAverage(q.options) : null);
          const scaledAverage = average != null ? Math.round(average * 10) : 0;
          // Modern reports report the response total directly; older reports lack
          // it, so sum their per-option counts.
          const responseCount =
            q.responses ?? (hasOptions ? q.options.reduce((sum, o) => sum + (o.count ?? 0), 0) : 0);

          questionIdx.push(internQuestion(q.question, scaledAverage > 0));
          responses.push(responseCount);
          averages.push(scaledAverage);
          if (q.registeredStudents != null) {
            anyRegistered = true;
            registered.push(q.registeredStudents);
          } else {
            registered.push(0);
          }
        }
        sections.push({
          section: section.section,
          professor: professors.intern(section.professor),
          questionSet: internQuestionSet(questionIdx),
          responses,
          registered: anyRegistered ? registered : [],
          averages,
        });
      }
      if (sections.length === 0) continue;
      protoCourses.push({ course: resolveCourse(course.code), sections });
    }
    protoTerms.push({ termId: term.termId, courses: protoCourses });
  }

  // Only scale (chartable) questions show a legend, so keep just the option sets
  // they reference and re-index them 1-based (dropping ones used solely by
  // categorical questions).
  const optionSetRemap = new Map<number, number>();
  const usedOptionSets: string[][] = [];
  const resolveOptionSet = (i: number): number => {
    const set = questionOptionSet[i];
    if (set === 0 || !questionScale[i]) return 0;
    let next = optionSetRemap.get(set);
    if (next === undefined) {
      usedOptionSets.push(optionSets[set - 1]);
      next = usedOptionSets.length;
      optionSetRemap.set(set, next);
    }
    return next;
  };

  return {
    questions: questionTexts.map((text, i) => ({
      text,
      scale: questionScale[i],
      optionSet: resolveOptionSet(i),
    })),
    professors: professors.values,
    professorRefs: professors.values.map((name) => {
      const idx = resolver?.index(name) ?? null;
      return idx == null ? 0 : idx + 1;
    }),
    extraCourses: extraCourses.values,
    indicesCourseCount,
    terms: protoTerms,
    questionSets: questionSets.map((questions) => ({ questions })),
    optionSets: usedOptionSets.map((options) => ({ options })),
  };
}

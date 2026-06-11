import type { FeedbackProto } from "@uoplan/proto";
import type { NormalizedCourseCode, ProfessorNameKey } from "./brand";
import { disciplineOf, levelOf, normalizeCourseCode } from "./utils/courseUtils";
import { normalizeProfessorName } from "./professorRatings";
import { decodeTermMeta } from "./gradeTrends";
import type { TermSeason } from "./gradeTrends";

/** Metadata for one distinct survey question. */
export interface FeedbackQuestionMeta {
  text: string;
  /** True when the question carries a numeric 1-5 average (chartable). */
  scale: boolean;
  /**
   * Ordinal response option labels, best-first (index 0 is the top of the scale,
   * mapping to 5; the last entry is the bottom, mapping to 1). Empty when the
   * labels are unknown (only older reports expose them).
   */
  options: string[];
}

/** One question's result within a single section. */
export interface FeedbackQuestionStat {
  /** Index into `FeedbackIndex.questions`. */
  questionId: number;
  /** Mean rating on a 1-5 scale, or `null` for categorical/missing questions. */
  average: number | null;
  /** Number of students who answered. */
  responses: number;
  /** Number of students invited, or `null` when unavailable (older reports). */
  registered: number | null;
}

/** One section's evaluation results within a term. */
export interface FeedbackSectionView {
  termId: number;
  section: string;
  professorName: string;
  /** Section-level invited count (uniform across questions), or `null`. */
  registered: number | null;
  questions: FeedbackQuestionStat[];
}

/** Decoded, lookup-friendly view of `feedback.pb`. */
export interface FeedbackIndex {
  questions: FeedbackQuestionMeta[];
  /** Section views keyed by normalized course code. */
  byCourseNorm: Map<NormalizedCourseCode, FeedbackSectionView[]>;
}

/**
 * Turn the raw `FeedbackData` message into lookup maps. Course codes are resolved
 * against the shared `indices.pb` course list (passed in) with the `extraCourses`
 * overflow, then normalized to match the explore offering keys.
 */
export function buildFeedbackIndex(
  data: FeedbackProto.FeedbackData,
  indicesCourses: readonly string[],
): FeedbackIndex {
  const questions: FeedbackQuestionMeta[] = data.questions.map((q) => ({
    text: q.text,
    scale: q.scale,
    options: q.optionSet > 0 ? (data.optionSets[q.optionSet - 1]?.options ?? []) : [],
  }));

  const resolveCode = (course: number): string | null => {
    if (course < data.indicesCourseCount) {
      return indicesCourses[course] ?? null;
    }
    return data.extraCourses[course - data.indicesCourseCount] ?? null;
  };

  const byCourseNorm = new Map<NormalizedCourseCode, FeedbackSectionView[]>();
  for (const term of data.terms) {
    for (const course of term.courses) {
      const code = resolveCode(course.course);
      if (code == null) continue;
      const norm = normalizeCourseCode(code);
      let bucket = byCourseNorm.get(norm);
      if (!bucket) {
        bucket = [];
        byCourseNorm.set(norm, bucket);
      }
      for (const section of course.sections) {
        const questionIds = data.questionSets[section.questionSet]?.questions ?? [];
        const hasRegistered = section.registered.length > 0;
        const stats: FeedbackQuestionStat[] = questionIds.map((questionId, i) => {
          const scaled = section.averages[i] ?? 0;
          const registered = hasRegistered ? (section.registered[i] ?? 0) : null;
          return {
            questionId,
            average: scaled > 0 ? scaled / 10 : null,
            responses: section.responses[i] ?? 0,
            registered,
          };
        });
        bucket.push({
          termId: term.termId,
          section: section.section,
          professorName: data.professors[section.professor] ?? "",
          registered: hasRegistered ? (section.registered[0] ?? null) : null,
          questions: stats,
        });
      }
    }
  }

  return { questions, byCourseNorm };
}

/** A single point on a per-question average-over-time series. */
export interface FeedbackTermPoint {
  termId: number;
  /** Response-weighted mean rating (1-5). */
  average: number;
  /** Total responses contributing to this point. */
  responses: number;
}

/** A per-question average-over-time series. */
export interface FeedbackQuestionSeries {
  questionId: number;
  text: string;
  points: FeedbackTermPoint[];
}

type WeightedFeedbackCell = { weighted: number; responses: number };

function addWeightedTermAverage(
  byTerm: Map<number, WeightedFeedbackCell>,
  termId: number,
  average: number,
  responses: number,
): void {
  const weight = responses > 0 ? responses : 1;
  const cell = byTerm.get(termId) ?? { weighted: 0, responses: 0 };
  cell.weighted += average * weight;
  cell.responses += weight;
  byTerm.set(termId, cell);
}

/**
 * For each scale question, the response-weighted average per term (ascending),
 * across the supplied section views. Questions with no data are omitted.
 */
export function feedbackQuestionSeries(
  views: readonly FeedbackSectionView[],
  questions: readonly FeedbackQuestionMeta[],
): FeedbackQuestionSeries[] {
  // questionId -> termId -> { weighted, responses }
  const acc = new Map<number, Map<number, WeightedFeedbackCell>>();
  for (const view of views) {
    for (const stat of view.questions) {
      if (stat.average == null) continue;
      let byTerm = acc.get(stat.questionId);
      if (!byTerm) {
        byTerm = new Map();
        acc.set(stat.questionId, byTerm);
      }
      addWeightedTermAverage(byTerm, view.termId, stat.average, stat.responses);
    }
  }

  const series: FeedbackQuestionSeries[] = [];
  for (const [questionId, byTerm] of acc) {
    const meta = questions[questionId];
    if (!meta) continue;
    const points: FeedbackTermPoint[] = [...byTerm.entries()]
      .map(([termId, cell]) => ({
        termId,
        average: cell.weighted / cell.responses,
        responses: cell.responses,
      }))
      .sort((a, b) => a.termId - b.termId);
    if (points.length === 0) continue;
    series.push({ questionId, text: meta.text, points });
  }
  // Most-answered questions first.
  series.sort(
    (a, b) =>
      b.points.reduce((s, p) => s + p.responses, 0) - a.points.reduce((s, p) => s + p.responses, 0),
  );
  return series;
}

/** High-level feedback summary for a set of sections. */
export interface FeedbackSummary {
  /** Response-weighted mean across all scale questions (1-5), or `null`. */
  overallAverage: number | null;
  /** Total responses across all scale questions. */
  totalResponses: number;
  /** Section respondents / invited where invited is known, or `null`. */
  responseRate: number | null;
  /** Distinct terms covered. */
  termsCovered: number;
}

/** Number of respondents for a section (the max answers across its questions). */
function sectionRespondents(view: FeedbackSectionView): number {
  let max = 0;
  for (const stat of view.questions) if (stat.responses > max) max = stat.responses;
  return max;
}

/** Response-weighted overall sentiment, total responses, and response rate. */
export function feedbackSummary(views: readonly FeedbackSectionView[]): FeedbackSummary {
  let weighted = 0;
  let weightSum = 0;
  let totalResponses = 0;
  let respondents = 0;
  let registered = 0;
  const terms = new Set<number>();
  for (const view of views) {
    terms.add(view.termId);
    for (const stat of view.questions) {
      if (stat.average == null) continue;
      const weight = stat.responses > 0 ? stat.responses : 1;
      weighted += stat.average * weight;
      weightSum += weight;
      totalResponses += stat.responses;
    }
    if (view.registered != null && view.registered > 0) {
      registered += view.registered;
      respondents += sectionRespondents(view);
    }
  }
  return {
    overallAverage: weightSum > 0 ? weighted / weightSum : null,
    totalResponses,
    responseRate: registered > 0 ? respondents / registered : null,
    termsCovered: terms.size,
  };
}

/** A response-rate point for one term. */
export interface FeedbackRatePoint {
  termId: number;
  /** Respondents / invited (0-1). */
  rate: number;
  respondents: number;
  registered: number;
}

/** Response-rate over time (terms where the invited count is known), ascending. */
export function feedbackResponseRateSeries(
  views: readonly FeedbackSectionView[],
): FeedbackRatePoint[] {
  const byTerm = new Map<number, { respondents: number; registered: number }>();
  for (const view of views) {
    if (view.registered == null || view.registered <= 0) continue;
    const cell = byTerm.get(view.termId) ?? { respondents: 0, registered: 0 };
    cell.respondents += sectionRespondents(view);
    cell.registered += view.registered;
    byTerm.set(view.termId, cell);
  }
  return [...byTerm.entries()]
    .map(([termId, c]) => ({
      termId,
      rate: c.registered > 0 ? c.respondents / c.registered : 0,
      respondents: c.respondents,
      registered: c.registered,
    }))
    .sort((a, b) => a.termId - b.termId);
}

/**
 * Per-term overall sentiment: response-weighted average across **all** scale
 * questions of the supplied views, ascending by term. Used for the high-level
 * university-wide (or scoped) sentiment-over-time line.
 */
export function feedbackOverallSeries(views: readonly FeedbackSectionView[]): FeedbackTermPoint[] {
  const byTerm = new Map<number, WeightedFeedbackCell>();
  for (const view of views) {
    for (const stat of view.questions) {
      if (stat.average == null) continue;
      addWeightedTermAverage(byTerm, view.termId, stat.average, stat.responses);
    }
  }
  return [...byTerm.entries()]
    .map(([termId, c]) => ({
      termId,
      average: c.responses > 0 ? c.weighted / c.responses : 0,
      responses: c.responses,
    }))
    .sort((a, b) => a.termId - b.termId);
}

/** Flatten every section view across all courses in the index (for global trends). */
export function feedbackAllViews(index: FeedbackIndex): FeedbackSectionView[] {
  const out: FeedbackSectionView[] = [];
  for (const bucket of index.byCourseNorm.values()) out.push(...bucket);
  return out;
}

/**
 * Per-course overall sentiment (response-weighted 1-5 average across the course's
 * sections), keyed by normalized course code. Each course's value already blends
 * its sections — and therefore the professors who taught them — so it carries a
 * combined course + professor signal. Courses with no scale feedback are omitted.
 */
export function courseSentimentByNorm(index: FeedbackIndex): Map<NormalizedCourseCode, number> {
  const out = new Map<NormalizedCourseCode, number>();
  for (const [norm, views] of index.byCourseNorm) {
    const avg = feedbackSummary(views).overallAverage;
    if (avg != null) out.set(norm, avg);
  }
  return out;
}

/**
 * Per-discipline overall sentiment (response-weighted 1-5 average across every
 * matching section), keyed by discipline code. Honors course-level and term-season
 * filters; disciplines with no scale feedback are omitted.
 */
export function disciplineSentiment(
  index: FeedbackIndex,
  options: { level?: number | null; season?: TermSeason | null } = {},
): Map<string, number> {
  const level = options.level ?? null;
  const season = options.season ?? null;
  const byDiscipline = new Map<string, FeedbackSectionView[]>();
  for (const [norm, views] of index.byCourseNorm) {
    const discipline = disciplineOf(norm);
    if (!discipline) continue;
    if (level != null && levelOf(norm) !== level) continue;
    for (const view of views) {
      if (season && decodeTermMeta(view.termId).season !== season) continue;
      let bucket = byDiscipline.get(discipline);
      if (!bucket) {
        bucket = [];
        byDiscipline.set(discipline, bucket);
      }
      bucket.push(view);
    }
  }

  const out = new Map<string, number>();
  for (const [discipline, views] of byDiscipline) {
    const avg = feedbackSummary(views).overallAverage;
    if (avg != null) out.set(discipline, avg);
  }
  return out;
}

/**
 * Per-professor overall sentiment (response-weighted 1-5 average across every
 * section that professor taught), keyed by {@link normalizeProfessorName}.
 * Professors with no scale feedback are omitted.
 */
export function professorSentimentByName(index: FeedbackIndex): Map<ProfessorNameKey, number> {
  const byName = new Map<ProfessorNameKey, FeedbackSectionView[]>();
  for (const views of index.byCourseNorm.values()) {
    for (const view of views) {
      const key = normalizeProfessorName(view.professorName);
      if (!key) continue;
      let bucket = byName.get(key);
      if (!bucket) {
        bucket = [];
        byName.set(key, bucket);
      }
      bucket.push(view);
    }
  }
  const out = new Map<ProfessorNameKey, number>();
  for (const [key, views] of byName) {
    const avg = feedbackSummary(views).overallAverage;
    if (avg != null) out.set(key, avg);
  }
  return out;
}

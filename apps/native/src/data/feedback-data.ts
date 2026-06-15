/**
 * Native feedback view-models, derived from the decoded `feedback.pb` index via
 * the SHARED `@uoplan/core/feedback` analytics (the same helpers the web feedback
 * pages use). Pure + side-effect-free so they unit-test without RN/proto.
 */
import {
  type FeedbackIndex,
  type FeedbackQuestionMeta,
  type FeedbackSectionView,
  feedbackAllViews,
  feedbackOverallSeries,
  feedbackQuestionSeries,
  feedbackResponseRateSeries,
  feedbackSummary,
  professorSentimentByName,
} from "@uoplan/core/feedback";
import { normalizeProfessorName } from "@uoplan/core/professorRatings";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import type { LineChartPoint } from "@/components/line-chart";

import { formatTermLabelShort } from "./trends-data";

export type { FeedbackIndex, FeedbackQuestionMeta, FeedbackSectionView };

/**
 * Per-professor overall satisfaction (1–5), keyed by `normalizeProfessorName`,
 * built in a single pass over the whole feedback index. Re-exported from core so
 * callers can do O(1) lookups instead of re-scanning the index per professor.
 */
export { professorSentimentByName };

/** Section views for one course code (empty when the course has no feedback). */
export function feedbackViewsForCourse(index: FeedbackIndex, code: string): FeedbackSectionView[] {
  return index.byCourseNorm.get(normalizeCourseCode(code)) ?? [];
}

/**
 * Every section view taught by a professor, matched by normalized name across all
 * courses in the index. This is the robust name-fallback join the web uses when
 * offering-level `(course, term, section)` keys are unavailable.
 */
export function feedbackViewsForProfessor(
  index: FeedbackIndex,
  professorName: string,
): FeedbackSectionView[] {
  const target = normalizeProfessorName(professorName);
  if (target.length === 0) return [];
  const out: FeedbackSectionView[] = [];
  for (const bucket of index.byCourseNorm.values()) {
    for (const view of bucket) {
      if (normalizeProfessorName(view.professorName) === target) out.push(view);
    }
  }
  return out;
}

export interface FeedbackHeadline {
  /** Response-weighted overall satisfaction on a 1-5 scale, or null. */
  satisfaction: number | null;
  totalResponses: number;
  /** Response rate (0-1) where invited counts are known, or null. */
  responseRate: number | null;
  termsCovered: number;
}

/** Headline satisfaction stats for a set of section views. */
export function feedbackHeadline(views: readonly FeedbackSectionView[]): FeedbackHeadline {
  const summary = feedbackSummary(views);
  return {
    satisfaction: summary.overallAverage,
    totalResponses: summary.totalResponses,
    responseRate: summary.responseRate,
    termsCovered: summary.termsCovered,
  };
}

/** Overall-sentiment-over-time as line-chart points (term label → 1-5 average). */
export function feedbackSentimentSeries(views: readonly FeedbackSectionView[]): LineChartPoint[] {
  return feedbackOverallSeries(views).map((p) => ({
    label: formatTermLabelShort(p.termId),
    value: Number(p.average.toFixed(2)),
  }));
}

/** Response-rate-over-time as line-chart points (term label → percentage 0-100). */
export function feedbackRateSeries(views: readonly FeedbackSectionView[]): LineChartPoint[] {
  return feedbackResponseRateSeries(views).map((p) => ({
    label: formatTermLabelShort(p.termId),
    value: Number((p.rate * 100).toFixed(1)),
  }));
}

export interface FeedbackQuestionChart {
  questionId: number;
  text: string;
  responsesTotal: number;
  points: LineChartPoint[];
}

/** Per-scale-question average-over-time charts (1-5), most-answered first. */
export function feedbackQuestionCharts(
  views: readonly FeedbackSectionView[],
  questions: readonly FeedbackQuestionMeta[],
): FeedbackQuestionChart[] {
  return feedbackQuestionSeries(views, questions)
    .map((q) => ({
      questionId: q.questionId,
      text: q.text,
      responsesTotal: q.points.reduce((sum, p) => sum + p.responses, 0),
      points: q.points.map((p) => ({
        label: formatTermLabelShort(p.termId),
        value: Number(p.average.toFixed(2)),
      })),
    }))
    .sort((a, b) => b.responsesTotal - a.responsesTotal);
}

export interface TrendsFeedbackData {
  sentiment: LineChartPoint[];
  rate: LineChartPoint[];
  questions: FeedbackQuestionChart[];
}

/** University-wide feedback charts for Trends, derived from every section view. */
export function trendsFeedbackData(index: FeedbackIndex): TrendsFeedbackData {
  const views = feedbackAllViews(index);
  return {
    sentiment: feedbackSentimentSeries(views),
    rate: feedbackRateSeries(views),
    questions: feedbackQuestionCharts(views, index.questions),
  };
}

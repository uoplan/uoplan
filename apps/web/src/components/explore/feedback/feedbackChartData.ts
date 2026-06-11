import { formatTermLabel, formatTermLabelShort } from "../../../lib/term/termLabel";

export const FEEDBACK_SENTIMENT_COLOR = "var(--app-info)";
export const FEEDBACK_RATE_COLOR = "var(--app-success)";

export interface FeedbackAveragePoint {
  termId: number;
  average: number;
}

export interface FeedbackRatePoint {
  termId: number;
  rate: number;
}

export function feedbackAverageChartData(points: readonly FeedbackAveragePoint[]) {
  return points.map((p) => ({
    term: formatTermLabelShort(p.termId),
    fullTerm: formatTermLabel(p.termId),
    average: Number(p.average.toFixed(2)),
  }));
}

export function feedbackRateChartData(points: readonly FeedbackRatePoint[]) {
  return points.map((p) => ({
    term: formatTermLabelShort(p.termId),
    fullTerm: formatTermLabel(p.termId),
    rate: Math.round(p.rate * 100),
  }));
}

export function formatFeedbackAverage(value: number) {
  return value.toFixed(2);
}

export function formatFeedbackRate(value: number) {
  return `${value}%`;
}

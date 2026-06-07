import type { AnalyticsMetric } from "@uoplan/core";
import { metricValue } from "@uoplan/core";
import { formatLocaleNumber } from "../../i18n";
import type { TrendsMetric } from "../../routes/trends";

/** Series colour per metric, shared by every trends chart. */
export const METRIC_COLOR: Record<TrendsMetric, string> = {
  gpa: "violet.5",
  "a-plus": "teal.6",
  "a-range": "blue.5",
  pass: "green.6",
  volume: "orange.5",
};

/** Map the page's URL metric to the core analytics metric (volume has none). */
export function toAnalyticsMetric(metric: TrendsMetric): AnalyticsMetric | null {
  switch (metric) {
    case "gpa":
      return "gpa";
    case "a-plus":
      return "aPlus";
    case "a-range":
      return "aRange";
    case "pass":
      return "pass";
    case "volume":
      return null;
  }
}

/** Localised formatting for a metric value (GPA 1dp, volume integer, else %). */
export function formatMetricValue(metric: TrendsMetric, value: number | null): string {
  if (value == null) return "—";
  if (metric === "gpa") {
    return formatLocaleNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (metric === "volume") {
    return formatLocaleNumber(Math.round(value));
  }
  return `${formatLocaleNumber(value, { maximumFractionDigits: 1 })}%`;
}

/** Metric fields shared by the comparison rows the cards consume. */
export interface MetricBundle {
  gpa: number | null;
  aPlusPct: number | null;
  aRangePct: number | null;
  passPct: number | null;
  volume: number;
}

/** Pick the active metric value (incl. volume) from a comparison row. */
export function pickMetric(bundle: MetricBundle, metric: TrendsMetric): number | null {
  if (metric === "volume") return bundle.volume;
  const analytics = toAnalyticsMetric(metric);
  return analytics ? metricValue(bundle, analytics) : null;
}

/** Recharts-friendly y-axis domain for a metric. */
export function metricDomain(metric: TrendsMetric): [number, number | "auto"] {
  if (metric === "gpa") return [0, 10];
  if (metric === "volume") return [0, "auto"];
  return [0, 100];
}

/**
 * Diverging colour for a GPA cell on the 0–10 scale (red → amber → green),
 * used by the discipline×year heatmap. `null` returns a neutral surface.
 */
export function gpaCellColor(gpa: number | null): string {
  if (gpa == null) return "var(--app-surface-muted, rgba(127,127,127,0.08))";
  // Anchor the visible range to typical GPA spread (≈5–9) for contrast.
  const t = Math.max(0, Math.min(1, (gpa - 5) / 4));
  // Hue 0 (red) → 130 (green); keep saturation/lightness readable in both themes.
  const hue = Math.round(t * 130);
  return `hsl(${hue}, 58%, 46%)`;
}

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
interface MetricBundle {
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

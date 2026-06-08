import { computeLevelComparison } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import type { TrendsCardContext } from "./cardContext";
import { MetricBarChartCard } from "./MetricBarChartCard";

function buildLevelRows({ grades, discipline, season }: TrendsCardContext) {
  return computeLevelComparison(grades, { discipline, season });
}

function getLevelLabel(row: ReturnType<typeof buildLevelRows>[number]): string {
  return String(row.level);
}

/**
 * Compares the active metric across course-level buckets (1000 → 9000) for the
 * current discipline scope — shows how difficulty shifts with level. Ignores the
 * page's level filter.
 */
export function LevelBarCard(props: TrendsCardContext) {
  useTr();

  return (
    <MetricBarChartCard
      title={tr("trends.chart.level.title")}
      description={tr("trends.chart.level.desc")}
      axisKey="level"
      buildRows={buildLevelRows}
      getAxisValue={getLevelLabel}
      {...props}
    />
  );
}

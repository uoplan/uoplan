import { computeLevelComparison, MAX_LEVEL_BUCKET } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import type { TrendsCardContext } from "./cardContext";
import { MetricBarChartCard } from "./MetricBarChartCard";

function buildLevelRows({ grades, discipline, season }: TrendsCardContext) {
  return computeLevelComparison(grades, { discipline, season });
}

function getLevelLabel(row: ReturnType<typeof buildLevelRows>[number]): string {
  return row.level >= MAX_LEVEL_BUCKET ? `${MAX_LEVEL_BUCKET}+` : String(row.level);
}

/**
 * Compares the active metric across course-level buckets (1000 → 5000+) for the
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

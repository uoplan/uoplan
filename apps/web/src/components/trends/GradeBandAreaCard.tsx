import { AreaChart } from "@mantine/charts";
import { computeGradeBandComposition, GRADE_BAND_META } from "@uoplan/core";
import type { GradeVizBucketId, TermSeason } from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import { GRADE_BAND_TOKEN } from "../../lib/trends/palette";
import { ChartCard } from "./ChartCard";
import type { TrendsCardContext } from "./cardContext";

const SEASON_SHORT: Record<TermSeason, string> = {
  fall: "F",
  winter: "W",
  springSummer: "S",
};

const BAND_LABEL_KEY: Record<GradeVizBucketId, string> = {
  red: "trends.band.failing",
  amber: "trends.band.lowPass",
  yellow: "trends.band.midPass",
  blue: "trends.band.good",
  teal: "trends.band.nearExcellent",
  green: "trends.band.excellent",
};

/**
 * Stacked 100% composition of grade bands (failing → excellent) per term for the
 * current scope — visualises grade inflation as the shape shifting upward.
 */
export function GradeBandAreaCard({
  grades,
  discipline,
  level,
  season,
  programFilter,
}: TrendsCardContext) {
  const data = useMemo(() => {
    const terms = computeGradeBandComposition(grades, { discipline, level, season, programFilter });
    return terms.map((term) => {
      const row: Record<string, string | number> = {
        term: `${term.season ? SEASON_SHORT[term.season] : "?"}${String(term.year).slice(2)}`,
      };
      for (const band of GRADE_BAND_META) row[band.id] = term.bands[band.id];
      return row;
    });
  }, [grades, discipline, level, season, programFilter]);

  return (
    <ChartCard
      title={tr("trends.chart.gradeBand.title")}
      description={tr("trends.chart.gradeBand.desc")}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <AreaChart
        h={300}
        data={data}
        dataKey="term"
        type="stacked"
        withDots={false}
        curveType="monotone"
        series={GRADE_BAND_META.map((band) => ({
          name: band.id,
          label: tr(BAND_LABEL_KEY[band.id]),
          color: GRADE_BAND_TOKEN[band.id],
        }))}
        yAxisProps={{ domain: [0, 100] }}
        valueFormatter={(value) => `${formatLocaleNumber(value, { maximumFractionDigits: 0 })}%`}
        withLegend
      />
    </ChartCard>
  );
}

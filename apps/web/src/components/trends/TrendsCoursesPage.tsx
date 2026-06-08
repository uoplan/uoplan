import { SimpleGrid } from "@mantine/core";
import { tr, useTr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { GradeBandAreaCard } from "./GradeBandAreaCard";
import { GradeHistogramCard } from "./GradeHistogramCard";
import { LevelBarCard } from "./LevelBarCard";
import { ProfessorSpreadCard } from "./ProfessorSpreadCard";
import { SeasonBarCard } from "./SeasonBarCard";
import { VolumeGpaScatterCard } from "./VolumeGpaScatterCard";
import { useTrends } from "./TrendsFilterProvider";

/**
 * "When and what to take" comparisons: the overall grade distribution and
 * composition for the current scope, season and level effects on the active
 * metric, plus course-level popularity↔GPA scatter and per-professor spread
 * (both require a program / discipline scope).
 */
export function TrendsCoursesPage() {
  useTr();
  const { cardContext, filteredMode } = useTrends();
  if (!cardContext) return null;

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <GradeBandAreaCard {...cardContext} />
      <GradeHistogramCard {...cardContext} />
      <SeasonBarCard {...cardContext} />
      <LevelBarCard {...cardContext} />
      {filteredMode ? (
        <VolumeGpaScatterCard {...cardContext} />
      ) : (
        <ChartCard
          title={tr("trends.chart.scatter.title")}
          description={tr("trends.chart.scatter.desc")}
          empty
          emptyText={tr("trends.chart.needScope")}
        >
          {null}
        </ChartCard>
      )}
      {filteredMode ? (
        <ProfessorSpreadCard {...cardContext} />
      ) : (
        <ChartCard
          title={tr("trends.chart.profSpread.title")}
          description={tr("trends.chart.profSpread.desc")}
          empty
          emptyText={tr("trends.chart.needScope")}
        >
          {null}
        </ChartCard>
      )}
    </SimpleGrid>
  );
}

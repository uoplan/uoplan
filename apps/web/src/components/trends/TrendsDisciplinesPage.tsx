import { SimpleGrid } from "@mantine/core";
import { useEffect, useRef } from "react";
import { useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { DisciplineBarCard } from "./DisciplineBarCard";
import { DisciplineHeatmapCard } from "./DisciplineHeatmapCard";
import { DisciplineScatterCard } from "./DisciplineScatterCard";
import { useTrends } from "./trendsContext";

/**
 * Cross-discipline comparisons: ranked metric bar, popularity↔GPA scatter, and a
 * discipline×year heatmap of grade drift.
 */
export function TrendsDisciplinesPage() {
  useTr();
  const analytics = useAnalytics();
  const lastDiscipline = useRef<string | null>(null);
  const { cardContext, discipline } = useTrends();
  useEffect(() => {
    const key = discipline ?? "all";
    if (lastDiscipline.current === key) return;
    lastDiscipline.current = key;
    analytics.capture("trends_discipline_viewed", { discipline: discipline ?? undefined });
  }, [analytics, discipline]);
  if (!cardContext) return null;

  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <DisciplineBarCard {...cardContext} />
        <DisciplineScatterCard {...cardContext} />
      </SimpleGrid>
      <DisciplineHeatmapCard {...cardContext} />
    </>
  );
}

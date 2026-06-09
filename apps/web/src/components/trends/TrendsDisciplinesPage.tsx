import { SimpleGrid } from "@mantine/core";
import { useTr } from "../../i18n";
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
  const { cardContext } = useTrends();
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

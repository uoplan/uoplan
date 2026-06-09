import { Box, SimpleGrid } from "@mantine/core";
import { AppCard } from "../shared/AppCard";

/**
 * Loading placeholder for the shared filter bar: an empty block reserving the
 * bar's height so the live controls don't shift layout when they swap in.
 */
export function TrendsFilterBarSkeleton() {
  return <Box h={50} />;
}

/**
 * A single empty placeholder card standing in for a chart card while trends
 * datasets are still loading.
 */
export function TrendsChartCardSkeleton({
  height = 280,
  style,
}: {
  height?: number;
  style?: React.CSSProperties;
}) {
  return <AppCard p="md" h={height} style={style} />;
}

/**
 * Loading placeholder mirroring the hub bento: a wide overview card spanning
 * both columns over a row of equal-height category cards.
 */
export function TrendsHubSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <Box
      style={{
        display: "grid",
        gap: "var(--mantine-spacing-md)",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        alignItems: "stretch",
      }}
    >
      <TrendsChartCardSkeleton
        height={310}
        style={{ gridColumn: isMobile ? undefined : "1 / -1" }}
      />
      <TrendsChartCardSkeleton height={215} />
      <TrendsChartCardSkeleton height={215} />
      <TrendsChartCardSkeleton height={215} />
      <TrendsChartCardSkeleton height={215} />
    </Box>
  );
}

/**
 * Loading placeholder for a sub-page: a responsive grid of equal-height chart
 * card skeletons.
 */
export function TrendsGridSkeleton({
  count = 4,
  height = 300,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      {Array.from({ length: count }, (_, i) => (
        <TrendsChartCardSkeleton key={i} height={height} />
      ))}
    </SimpleGrid>
  );
}

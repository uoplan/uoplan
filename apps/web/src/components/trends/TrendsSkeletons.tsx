import { Box, Skeleton, SimpleGrid, Stack } from "@mantine/core";
import { AppCard } from "../shared/AppCard";

/**
 * A single placeholder chart card: a title/description stub above a large block
 * standing in for the chart. Used while trends datasets are still loading.
 */
export function TrendsChartCardSkeleton({
  height = 200,
  style,
}: {
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <AppCard p="md" h="100%" style={style}>
      <Stack gap="sm" h="100%">
        <Stack gap={6}>
          <Skeleton height={14} width="42%" radius="sm" />
          <Skeleton height={9} width="68%" radius="sm" />
        </Stack>
        <Skeleton height={height} radius="sm" mt="auto" />
      </Stack>
    </AppCard>
  );
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
        height={240}
        style={{ gridColumn: isMobile ? undefined : "1 / -1" }}
      />
      <TrendsChartCardSkeleton height={128} />
      <TrendsChartCardSkeleton height={128} />
      <TrendsChartCardSkeleton height={128} />
      <TrendsChartCardSkeleton height={128} />
    </Box>
  );
}

/**
 * Loading placeholder for a sub-page: a responsive grid of equal-height chart
 * card skeletons.
 */
export function TrendsGridSkeleton({
  count = 4,
  height = 240,
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

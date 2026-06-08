import { Box, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { AppCard } from "../shared/AppCard";

/**
 * Shared card shell for a single trends chart: title, optional description, and
 * a centered placeholder when there is no data / no scope to render.
 *
 * The card fills the height of its grid row, and the chart is anchored to the
 * bottom so that when a sibling card in the same row is taller, the extra space
 * appears between the title and the chart rather than as dead space below it.
 */
export function ChartCard({
  title,
  description,
  empty,
  emptyText,
  children,
}: {
  title: string;
  description?: string;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <AppCard p="md" h="100%">
      <Stack gap="sm" h="100%">
        <Stack gap={2}>
          <Text fw={600} c="var(--app-text)">
            {title}
          </Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        {empty ? (
          <Text
            size="sm"
            c="dimmed"
            py="lg"
            ta="center"
            style={{ marginTop: "auto", marginBottom: "auto" }}
          >
            {emptyText}
          </Text>
        ) : (
          <Box style={{ marginTop: "auto" }}>{children}</Box>
        )}
      </Stack>
    </AppCard>
  );
}

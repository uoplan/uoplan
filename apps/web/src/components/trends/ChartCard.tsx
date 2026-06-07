import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { AppCard } from "../shared/AppCard";

/**
 * Shared card shell for a single trends chart: title, optional description, and
 * a centered placeholder when there is no data / no scope to render.
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
    <AppCard p="md">
      <Stack gap="sm">
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
          <Text size="sm" c="dimmed" py="lg" ta="center">
            {emptyText}
          </Text>
        ) : (
          children
        )}
      </Stack>
    </AppCard>
  );
}

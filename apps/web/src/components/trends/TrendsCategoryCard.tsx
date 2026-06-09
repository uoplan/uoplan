import { Box, Group, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toUrlSearch } from "../../lib/trends/searchParams";
import { AppCard } from "../shared/AppCard";
import { useTrends } from "./trendsContext";

type TrendsCategoryTo =
  | "/trends/disciplines"
  | "/trends/courses"
  | "/trends/feedback"
  | "/trends/leaderboard";

/** Shared preview height so every category card lines up to the same height. */
export const CATEGORY_PREVIEW_HEIGHT = 128;

/**
 * Hub navigation card for a trends category: a label, a short blurb, and a
 * fixed-height preview area, linking to the category's sub-route while carrying
 * the current filters along in the URL.
 */
export function TrendsCategoryCard({
  to,
  title,
  description,
  preview,
}: {
  to: TrendsCategoryTo;
  title: string;
  description: string;
  preview?: ReactNode;
}) {
  const { search } = useTrends();

  return (
    <Link
      to={to}
      search={toUrlSearch(search)}
      style={{ textDecoration: "none", display: "block", height: "100%" }}
    >
      <AppCard p="md" interactive h="100%">
        <Stack gap="sm" h="100%">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Stack gap={2}>
              <Text fw={600} c="var(--app-text)">
                {title}
              </Text>
              <Text size="xs" c="dimmed">
                {description}
              </Text>
            </Stack>
            <IconArrowRight size={18} stroke={1.6} color="var(--app-accent)" />
          </Group>
          <Box
            style={{
              marginTop: "auto",
              height: CATEGORY_PREVIEW_HEIGHT,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {preview}
          </Box>
        </Stack>
      </AppCard>
    </Link>
  );
}

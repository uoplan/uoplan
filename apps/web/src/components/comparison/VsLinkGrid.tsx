import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { tr } from "../../i18n";
import { COMPETITORS } from "../../lib/comparison";
import { AppCard } from "../shared/AppCard";

/**
 * Grid of "uoPlan vs <competitor>" link cards, shared by `/features` and
 * `/compare` for internal SEO linking. `ctaId` is the translation id for each
 * card's title (it takes a `{name}` value) so the two surfaces can use their own
 * copy while sharing one layout.
 */
export function VsLinkGrid({ ctaId }: { ctaId: string }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {COMPETITORS.map((competitor) => (
        <Link
          key={competitor.id}
          to="/vs/$competitor"
          params={{ competitor: competitor.vsSlug as string }}
          style={{ display: "block", textDecoration: "none" }}
        >
          <AppCard interactive p="md" radius="lg">
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
              <Stack gap={2}>
                <Text fw={600} c="var(--app-text)">
                  {tr(ctaId, { name: competitor.name })}
                </Text>
                <Text size="xs" c="var(--app-text-dim)">
                  {tr(competitor.taglineId)}
                </Text>
              </Stack>
              <IconArrowRight size={18} color="var(--app-accent)" />
            </Group>
          </AppCard>
        </Link>
      ))}
    </SimpleGrid>
  );
}

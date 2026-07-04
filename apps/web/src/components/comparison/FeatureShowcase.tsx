import { Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconArrowRight,
  IconBell,
  IconBinaryTree,
  IconCalendarTime,
  IconChartBar,
  IconClipboardCheck,
  IconDatabase,
  IconDeviceMobile,
  IconLanguage,
  IconSchool,
  IconSearch,
  IconShare,
  IconShieldLock,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { tr, useTr } from "../../i18n";
import { featuresByCategory, uoplanFeatures } from "../../lib/comparison";
import { AppCard } from "../shared/AppCard";
import { PageContainer } from "../shared/PageContainer";
import { ComparisonCta } from "./ComparisonCta";
import { VsLinkGrid } from "./VsLinkGrid";

type IconComponent = ComponentType<{ size?: number | string; stroke?: number; color?: string }>;

const CATEGORY_ICON: Record<string, IconComponent> = {
  scheduling: IconCalendarTime,
  degree: IconSchool,
  prerequisites: IconBinaryTree,
  grades: IconChartBar,
  professors: IconUsers,
  explore: IconSearch,
  enrolment: IconClipboardCheck,
  sharing: IconShare,
  notifications: IconBell,
  platforms: IconDeviceMobile,
  access: IconLanguage,
  privacy: IconShieldLock,
  data: IconDatabase,
};

function Eyebrow({ children }: { children: string }) {
  return (
    <Text
      span
      ff="monospace"
      fz="xs"
      style={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--app-accent)" }}
    >
      {children}
    </Text>
  );
}

/**
 * `/features` — the complete, categorized uoPlan feature set (the marketing hub
 * that links out to `/compare` and each `/vs/<slug>` for internal SEO). Reads
 * the shared comparison data so it can never drift from the matrix.
 */
export function FeatureShowcase() {
  useTr();
  const groups = featuresByCategory(uoplanFeatures());
  const featureCount = uoplanFeatures().length;

  return (
    <Box component="main" py={{ base: 28, sm: 44 }} style={{ backgroundColor: "var(--app-bg)" }}>
      <PageContainer>
        <Stack gap={40}>
          <Stack gap="md" maw={640}>
            <Eyebrow>{tr("features.hero.eyebrow")}</Eyebrow>
            <Title
              order={1}
              ff="var(--app-font-heading)"
              fw={400}
              lh={1.08}
              fz={{ base: 34, sm: 46 }}
              c="var(--app-text)"
            >
              {tr("features.hero.title")}
            </Title>
            <Text size="lg" lh={1.5} c="var(--app-text-muted)">
              {tr("features.hero.subtitle", { count: featureCount })}
            </Text>
            <Group gap="sm" mt={4}>
              <Button
                component={Link}
                to="/schedule"
                size="md"
                rightSection={<IconArrowRight size={16} />}
              >
                {tr("features.hero.ctaPlan")}
              </Button>
              <Button component={Link} to="/compare" size="md" variant="default">
                {tr("features.hero.ctaCompare")}
              </Button>
            </Group>
          </Stack>

          <Stack gap={24}>
            {groups.map(({ category, features }) => {
              const CategoryIcon = CATEGORY_ICON[category.id] ?? IconClipboardCheck;
              return (
                <AppCard key={category.id} p={{ base: "md", sm: "lg" }} radius="lg">
                  <Stack gap="md">
                    <Group gap={10} align="center">
                      <Box
                        aria-hidden
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 34,
                          height: 34,
                          borderRadius: "var(--app-radius-md)",
                          background: "color-mix(in oklab, var(--app-accent) 14%, transparent)",
                          color: "var(--app-accent)",
                        }}
                      >
                        <CategoryIcon size={19} stroke={1.8} />
                      </Box>
                      <Title
                        order={2}
                        ff="var(--app-font-heading)"
                        fw={400}
                        fz="xl"
                        c="var(--app-text)"
                      >
                        {tr(category.labelId)}
                      </Title>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      {features.map((feature) => (
                        <Stack key={feature.id} gap={2}>
                          <Text fw={600} size="sm" c="var(--app-text)">
                            {tr(feature.nameId)}
                          </Text>
                          <Text size="sm" lh={1.45} c="var(--app-text-dim)">
                            {tr(feature.descId)}
                          </Text>
                        </Stack>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </AppCard>
              );
            })}
          </Stack>

          <AppCard
            variant="overlay"
            p={{ base: "lg", sm: "xl" }}
            radius="lg"
            style={{ borderColor: "color-mix(in oklab, var(--app-accent) 40%, var(--app-border))" }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="md">
              <Stack gap={4} style={{ flex: "1 1 320px" }}>
                <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
                  {tr("features.compareCallout.title")}
                </Title>
                <Text size="sm" c="var(--app-text-muted)">
                  {tr("features.compareCallout.body")}
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/compare"
                size="md"
                variant="light"
                rightSection={<IconArrowRight size={16} />}
              >
                {tr("features.compareCallout.cta")}
              </Button>
            </Group>
          </AppCard>

          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
                {tr("features.vs.title")}
              </Title>
              <Text size="sm" c="var(--app-text-muted)" maw={560}>
                {tr("features.vs.body")}
              </Text>
            </Stack>
            <VsLinkGrid ctaId="features.vs.cardCta" />
          </Stack>

          <ComparisonCta />
        </Stack>
      </PageContainer>
    </Box>
  );
}

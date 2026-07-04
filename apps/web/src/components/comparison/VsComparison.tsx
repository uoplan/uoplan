import { Badge, Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight, IconExternalLink } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { tr, useTr } from "../../i18n";
import { UOPLAN, vsPairing } from "../../lib/comparison";
import type { Feature, Product } from "../../lib/comparison";
import { AppCard } from "../shared/AppCard";
import { BackButton } from "../shared/BackButton";
import { PageContainer } from "../shared/PageContainer";
import { ComparisonCta } from "./ComparisonCta";
import { ComparisonTable } from "./ComparisonTable";

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <AppCard variant="sunken" p="md" radius="lg">
      <Stack gap={2} align="center" ta="center">
        <Text ff="var(--app-font-heading)" fz={34} lh={1} c="var(--app-accent)">
          {value}
        </Text>
        <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
          {label}
        </Text>
      </Stack>
    </AppCard>
  );
}

function FeatureCardGrid({ features }: { features: Feature[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {features.map((feature) => (
        <AppCard key={feature.id} p="md" radius="lg">
          <Stack gap={3}>
            <Text fw={600} size="sm" c="var(--app-text)">
              {tr(feature.nameId)}
            </Text>
            <Text size="sm" lh={1.45} c="var(--app-text-dim)">
              {tr(feature.descId)}
            </Text>
          </Stack>
        </AppCard>
      ))}
    </SimpleGrid>
  );
}

/**
 * `/vs/<slug>` — a 1-on-1, uoPlan-favouring (but honest) comparison against one
 * competitor. Built entirely from the shared matrix via `vsPairing`, so the
 * "where uoPlan wins / ties / where they win" split can never contradict
 * `/compare`.
 */
export function VsComparison({ competitor }: { competitor: Product }) {
  useTr();
  const { uoplanWins, ties, competitorWins } = vsPairing(competitor);
  const products = [UOPLAN, competitor];

  return (
    <Box component="main" py={{ base: 24, sm: 40 }} style={{ backgroundColor: "var(--app-bg)" }}>
      <PageContainer>
        <Stack gap={36}>
          <Stack gap="md">
            <BackButton fallbackTo="/compare" fallbackLabel={tr("vs.backToCompare")} />
            <Text
              span
              ff="monospace"
              fz="xs"
              style={{
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--app-accent)",
              }}
            >
              {tr("vs.hero.eyebrow")}
            </Text>
            <Title
              order={1}
              ff="var(--app-font-heading)"
              fw={400}
              lh={1.08}
              fz={{ base: 32, sm: 44 }}
              c="var(--app-text)"
            >
              {tr("vs.hero.title", { name: competitor.name })}
            </Title>
            <Text size="lg" lh={1.5} c="var(--app-text-muted)" maw={640}>
              {tr(`vs.intro.${competitor.vsSlug}`)}
            </Text>
            <Group gap="sm" mt={4}>
              <Button
                component={Link}
                to="/schedule"
                size="md"
                rightSection={<IconArrowRight size={16} />}
              >
                {tr("cta.plan")}
              </Button>
              <Button
                component="a"
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
                variant="default"
                rightSection={<IconExternalLink size={15} />}
              >
                {tr("vs.hero.visit", { name: competitor.name })}
              </Button>
            </Group>
          </Stack>

          <SimpleGrid cols={{ base: 3 }} spacing="md">
            <StatCard value={uoplanWins.length} label={tr("vs.stats.uoplanWins")} />
            <StatCard value={ties.length} label={tr("vs.stats.ties")} />
            <StatCard
              value={competitorWins.length}
              label={tr("vs.stats.competitorWins", { name: competitor.name })}
            />
          </SimpleGrid>

          {uoplanWins.length > 0 ? (
            <Stack gap="md">
              <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
                {tr("vs.wins.title")}
              </Title>
              <FeatureCardGrid features={uoplanWins} />
            </Stack>
          ) : null}

          <Stack gap="md">
            <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
              {tr("vs.gaps.title", { name: competitor.name })}
            </Title>
            {competitorWins.length > 0 ? (
              <FeatureCardGrid features={competitorWins} />
            ) : (
              <AppCard variant="sunken" p="md" radius="lg">
                <Text size="sm" c="var(--app-text-muted)">
                  {tr("vs.gaps.empty", { name: competitor.name })}
                </Text>
              </AppCard>
            )}
          </Stack>

          {ties.length > 0 ? (
            <Stack gap="sm">
              <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
                {tr("vs.ties.title", { name: competitor.name })}
              </Title>
              <Group gap={8}>
                {ties.map((feature) => (
                  <Badge
                    key={feature.id}
                    variant="light"
                    color="gray"
                    size="lg"
                    radius="sm"
                    styles={{ root: { textTransform: "none", fontWeight: 500 } }}
                  >
                    {tr(feature.nameId)}
                  </Badge>
                ))}
              </Group>
            </Stack>
          ) : null}

          <Stack gap="md">
            <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
              {tr("vs.table.title", { name: competitor.name })}
            </Title>
            <ComparisonTable products={products} onlyRelevant compact />
            <Text
              component={Link}
              to="/compare"
              size="sm"
              c="var(--app-accent)"
              style={{ textDecoration: "none" }}
            >
              {tr("vs.backToCompare")} →
            </Text>
          </Stack>

          <Text size="xs" c="var(--app-text-dim)">
            {tr("compare.disclaimer")}
          </Text>

          <ComparisonCta />
        </Stack>
      </PageContainer>
    </Box>
  );
}

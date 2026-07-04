import { Box, Stack, Text, Title } from "@mantine/core";
import { tr, useTr } from "../../i18n";
import { PageContainer } from "../shared/PageContainer";
import { ComparisonCta } from "./ComparisonCta";
import { ComparisonTable } from "./ComparisonTable";
import { SupportLegend } from "./SupportCell";
import { VsLinkGrid } from "./VsLinkGrid";

/**
 * `/compare` — the master comparison table (uoPlan vs every tracked competitor)
 * plus a legend, honest-comparison disclaimer, and links out to each
 * head-to-head `/vs/<slug>` page. All rows come from the shared matrix.
 */
export function ComparisonPage() {
  useTr();
  return (
    <Box component="main" py={{ base: 24, sm: 40 }} style={{ backgroundColor: "var(--app-bg)" }}>
      <PageContainer>
        <Stack gap={32}>
          <Stack gap="md" maw={680}>
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
              {tr("compare.hero.eyebrow")}
            </Text>
            <Title
              order={1}
              ff="var(--app-font-heading)"
              fw={400}
              lh={1.08}
              fz={{ base: 32, sm: 44 }}
              c="var(--app-text)"
            >
              {tr("compare.hero.title")}
            </Title>
            <Text size="lg" lh={1.5} c="var(--app-text-muted)">
              {tr("compare.hero.subtitle")}
            </Text>
          </Stack>

          <SupportLegend />

          <ComparisonTable />

          <Text size="xs" c="var(--app-text-dim)">
            {tr("compare.disclaimer")}
          </Text>

          <Stack gap="md">
            <Title order={2} ff="var(--app-font-heading)" fw={400} fz="xl" c="var(--app-text)">
              {tr("compare.vsLinks.title")}
            </Title>
            <VsLinkGrid ctaId="compare.vsLinks.cta" />
          </Stack>

          <ComparisonCta />
        </Stack>
      </PageContainer>
    </Box>
  );
}

import { Button, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { tr } from "../../i18n";
import { AppCard } from "../shared/AppCard";

/** Shared "start planning" call-to-action card used across the comparison pages. */
export function ComparisonCta() {
  return (
    <AppCard variant="sunken" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Stack gap="sm" align="center" ta="center">
        <Title order={2} ff="var(--app-font-heading)" fw={400} c="var(--app-text)">
          {tr("cta.title")}
        </Title>
        <Text size="sm" c="var(--app-text-muted)" maw={520}>
          {tr("cta.body")}
        </Text>
        <Button
          component={Link}
          to="/schedule"
          size="md"
          mt={4}
          rightSection={<IconArrowRight size={16} />}
        >
          {tr("cta.plan")}
        </Button>
      </Stack>
    </AppCard>
  );
}

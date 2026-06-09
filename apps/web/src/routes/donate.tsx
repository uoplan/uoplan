import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Box, Card, CopyButton, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { DonationJar } from "../components/donate/DonationJar";
import { BackButton } from "../components/shared/BackButton";
import { useTr, tr, formatLocaleNumber } from "../i18n";
import { buildTabTitle } from "../lib/seo";

const DONATION_EMAIL = "donate@uoplan.party";

interface DonationSummary {
  goalCents: number;
  totalCents: number;
  currency: string;
  updatedAt: string;
}

export const Route = createFileRoute("/donate")({
  head: () => buildTabTitle("Donate"),
  component: DonateRoute,
});

function formatCurrency(cents: number, currency: string): string {
  return formatLocaleNumber(cents / 100, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function DonateRoute() {
  useTr();
  const [summary, setSummary] = useState<DonationSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/donations")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DonationSummary>;
      })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goalCents = summary?.goalCents ?? 100000;
  const currency = summary?.currency ?? "CAD";
  const totalCents = summary?.totalCents ?? 0;
  const percent = goalCents > 0 ? totalCents / goalCents : 0;
  const percentLabel = Math.round(percent * 100);

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "var(--app-bg)",
        boxSizing: "border-box",
      }}
    >
      <Stack gap="lg" maw={680} mx="auto">
        <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />

        <Stack gap={4}>
          <Title order={2} c="var(--app-text)" fw={600}>
            {tr("donate.title")}
          </Title>
          <Text c="dimmed" size="sm">
            {tr("donate.subtitle")}
          </Text>
        </Stack>

        <Card withBorder radius="lg" padding="xl" bg="var(--app-surface)">
          <Group align="center" justify="center" gap={48} wrap="wrap">
            <DonationJar percent={percent} />

            <Stack gap={8} miw={200}>
              <Text size="sm" c="dimmed" fw={600} tt="uppercase">
                {tr("donate.raisedLabel")}
              </Text>
              <Text size="2.4rem" fw={700} c="var(--app-text)" lh={1.1}>
                {summary ? formatCurrency(totalCents, currency) : "—"}
              </Text>
              <Text size="sm" c="dimmed">
                {tr("donate.ofGoal", {
                  goal: formatCurrency(goalCents, currency),
                  percent: percentLabel,
                })}
              </Text>
              {error && (
                <Text size="xs" c="dimmed" fs="italic">
                  {tr("donate.unavailable")}
                </Text>
              )}
            </Stack>
          </Group>
        </Card>

        <Card withBorder radius="lg" padding="lg" bg="var(--app-surface)">
          <Stack gap={10}>
            <Title order={4} c="var(--app-text)" fw={600}>
              {tr("donate.how.title")}
            </Title>
            <Text size="sm" c="var(--app-text)">
              {tr("donate.how.body")}
            </Text>
            <Group gap={8} align="center">
              <Text size="sm" fw={600} c="var(--app-text)" ff="monospace">
                {DONATION_EMAIL}
              </Text>
              <CopyButton value={DONATION_EMAIL}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? tr("donate.copied") : tr("donate.copy")} withArrow>
                    <Text
                      component="button"
                      onClick={copy}
                      size="sm"
                      c="var(--mantine-color-accentBlue-4)"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {copied ? tr("donate.copied") : tr("donate.copy")}
                    </Text>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" c="dimmed">
              {tr("donate.how.note")}
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}

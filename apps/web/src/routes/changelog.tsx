import { createFileRoute } from "@tanstack/react-router";
import { Box, Stack, Title } from "@mantine/core";
import changelogHtml from "virtual:changelog-html";
import { tr, useTr } from "../i18n";
import { buildTabTitle } from "../lib/seo";
import { BackButton } from "../components/shared/BackButton";

export const Route = createFileRoute("/changelog")({
  head: () => buildTabTitle("Changelog"),
  component: ChangelogRoute,
});

function ChangelogRoute() {
  useTr();

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
      <Stack gap="md" maw={900} mx="auto">
        <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />
        <Title order={2} c="var(--app-text)" fw={600}>
          {tr("app.changelog.title")}
        </Title>
        <Box className="changelog-html" dangerouslySetInnerHTML={{ __html: changelogHtml }} />
      </Stack>
    </Box>
  );
}

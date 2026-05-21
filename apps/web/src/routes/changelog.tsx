import { createFileRoute } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { Box, Stack, Title } from "@mantine/core";
import changelogHtml from "virtual:changelog-html";
import { tr } from "../i18n";
import { buildTabTitle } from "../lib/seo";

export const Route = createFileRoute("/changelog")({
  head: () => buildTabTitle("Changelog"),
  component: ChangelogRoute,
});

function ChangelogRoute() {
  useLingui();

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "#141517",
        boxSizing: "border-box",
      }}
    >
      <Stack gap="md" maw={900} mx="auto">
        <Title order={2} c="#F8F9FA" fw={600}>
          {tr("app.changelog.title")}
        </Title>
        <Box className="changelog-html" dangerouslySetInnerHTML={{ __html: changelogHtml }} />
      </Stack>
    </Box>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { Box, Button, ScrollArea, Stack, Title } from "@mantine/core";
import { motion } from "framer-motion";
import changelogHtml from "virtual:changelog-html";
import { tr } from "../i18n";

export const Route = createFileRoute("/changelog")({
  component: ChangelogRoute,
});

function ChangelogRoute() {
  useLingui();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      style={{ width: "100%", minHeight: "100vh" }}
    >
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
          <Link to="/step/term" style={{ alignSelf: "flex-start" }}>
            <Button variant="subtle" color="gray" size="sm">
              {tr("app.nav.back")}
            </Button>
          </Link>
          <Title order={2} c="#F8F9FA" fw={600}>
            {tr("app.changelog.title")}
          </Title>
          <ScrollArea.Autosize mah="calc(100vh - 140px)" type="auto" offsetScrollbars>
            <Box className="changelog-html" dangerouslySetInnerHTML={{ __html: changelogHtml }} />
          </ScrollArea.Autosize>
        </Stack>
      </Box>
    </motion.div>
  );
}

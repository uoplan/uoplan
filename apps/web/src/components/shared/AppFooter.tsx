import { Anchor, Box, Group, Kbd, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery, useOs } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCommandCenterStore } from "../../store/commandCenterStore";
import { tr, useTr } from "../../i18n";
import { seasonalFlourish } from "../../lib/easterEggs/seasonal";
import { AnalyticsOptOutControl } from "./AnalyticsOptOutControl";
import { PageContainer } from "./PageContainer";

const GITHUB_URL = "https://github.com/uoplan/uoplan";
const FEEDBACK_EMAIL = "admin@uoplan.party";

function ColumnHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      span
      fz="xs"
      fw={600}
      lh={1.4}
      style={{ color: "var(--app-text)", letterSpacing: "0.04em", opacity: 0.85 }}
    >
      {children}
    </Text>
  );
}

const footerLinkStyle = { textDecoration: "none", cursor: "pointer" } as const;

export function AppFooter() {
  useTr();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const os = useOs();
  const modLabel = os === "macos" ? "⌘" : "Ctrl";
  const flourish = seasonalFlourish();

  const buildBranch = (
    typeof __BRANCH_NAME__ !== "undefined" && __BRANCH_NAME__
      ? __BRANCH_NAME__
      : tr("app.footer.buildBranchFallback")
  ).toLowerCase();
  const buildCommit = (
    typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev"
  ).toLowerCase();

  return (
    <Box
      component="footer"
      pt={isMobile ? 28 : 40}
      pb="max(20px, env(safe-area-inset-bottom))"
      style={{
        alignSelf: "stretch",
        borderTop: "1px solid var(--app-border)",
        backgroundColor: "var(--app-bg)",
      }}
    >
      <PageContainer>
        <Stack gap={isMobile ? 28 : 40}>
          <Group justify="space-between" align="flex-start" wrap="wrap" gap={isMobile ? 28 : 48}>
            <Stack gap={8} style={{ flex: "1 1 260px", maxWidth: 360 }}>
              <Text
                span
                ff="var(--app-font-heading)"
                fz="lg"
                fw={400}
                lh={1.2}
                style={{ color: "var(--app-text)" }}
              >
                uoplan.party
              </Text>
              <Text size="sm" lh={1.55} style={{ color: "var(--app-text-dim)" }}>
                {tr("app.footer.tagline")}
              </Text>
            </Stack>

            <Group align="flex-start" wrap="wrap" gap={isMobile ? 28 : 64}>
              <Stack gap={10} style={{ minWidth: 120 }}>
                <ColumnHeading>{tr("app.footer.sectionNavigate")}</ColumnHeading>
                <Group gap={isMobile ? 28 : 44} align="flex-start" wrap="nowrap">
                  <Stack gap={10}>
                    <Text
                      component={Link}
                      to="/features"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.features")}
                    </Text>
                    <Text
                      component={Link}
                      to="/compare"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.compare")}
                    </Text>
                    <Text
                      component={Link}
                      to="/explore"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.explore")}
                    </Text>
                  </Stack>
                  <Stack gap={10}>
                    <Text
                      component={Link}
                      to="/professor-graph"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.graph")}
                    </Text>
                    <Text
                      component={Link}
                      to="/trends"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.trends")}
                    </Text>
                    <Text
                      component={Link}
                      to="/donate"
                      size="sm"
                      c="dimmed"
                      lh={1.45}
                      className="app-footer-link"
                      style={footerLinkStyle}
                    >
                      {tr("app.footer.donate")}
                    </Text>
                  </Stack>
                </Group>
              </Stack>

              <Stack gap={10} style={{ minWidth: 120 }}>
                <ColumnHeading>{tr("app.footer.sectionProject")}</ColumnHeading>
                <Anchor
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  c="dimmed"
                  underline="never"
                  lh={1.45}
                  className="app-footer-link"
                >
                  github
                </Anchor>
                <Text
                  component={Link}
                  to="/changelog"
                  size="sm"
                  c="dimmed"
                  lh={1.45}
                  className="app-footer-link"
                  style={footerLinkStyle}
                >
                  {tr("app.footer.changelog")}
                </Text>
                <UnstyledButton
                  onClick={() => useCommandCenterStore.getState().requestOpen()}
                  style={{ color: "var(--mantine-color-dimmed)" }}
                >
                  <Group gap={6} align="center" wrap="nowrap">
                    <Text span size="sm" c="dimmed" lh={1.45}>
                      {tr("app.footer.commandCenter")}
                    </Text>
                    <Kbd size="xs">{modLabel}</Kbd>
                    <Kbd size="xs">K</Kbd>
                  </Group>
                </UnstyledButton>
                <Anchor
                  href={`mailto:${FEEDBACK_EMAIL}`}
                  size="sm"
                  c="dimmed"
                  underline="never"
                  lh={1.45}
                  className="app-footer-link"
                  title={tr("app.footer.feedbackPrompt")}
                >
                  {FEEDBACK_EMAIL}
                </Anchor>
              </Stack>
            </Group>
          </Group>

          <Stack
            gap={12}
            style={{
              borderTop: "1px solid var(--app-border)",
              paddingTop: isMobile ? 18 : 22,
            }}
          >
            <Group justify="space-between" align="baseline" wrap="wrap" gap={12}>
              <Text span size="xs" c="dimmed" ff="monospace" lh={1.45}>
                {buildBranch}
                {" · "}
                {buildCommit}
              </Text>
              {flourish ? (
                <Text span size="xs" c="dimmed" lh={1.45}>
                  <span aria-hidden>{flourish.emoji}</span> {tr(flourish.msgId)}
                </Text>
              ) : null}
            </Group>

            <Group gap={20} wrap="wrap">
              <Text
                component={Link}
                to="/privacy"
                size="sm"
                c="dimmed"
                lh={1.45}
                className="app-footer-link"
                style={footerLinkStyle}
              >
                {tr("app.footer.privacy")}
              </Text>
              <Text
                component={Link}
                to="/terms"
                size="sm"
                c="dimmed"
                lh={1.45}
                className="app-footer-link"
                style={footerLinkStyle}
              >
                {tr("app.footer.terms")}
              </Text>
              <AnalyticsOptOutControl />
            </Group>

            <Text size="sm" lh={1.6} style={{ color: "var(--app-text-dim)" }}>
              {tr("app.footer.notAffiliated")}
            </Text>
          </Stack>
        </Stack>
      </PageContainer>
    </Box>
  );
}

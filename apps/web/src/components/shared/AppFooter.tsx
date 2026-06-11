import { Anchor, Box, Group, Kbd, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery, useOs } from "@mantine/hooks";
import { Link, useLocation } from "@tanstack/react-router";
import { useCommandCenterStore } from "../../store/commandCenterStore";
import { tr, useTr } from "../../i18n";
import { labelForPath } from "../../lib/navigation/backState";
import { seasonalFlourish } from "../../lib/easterEggs/seasonal";

const ONTARIO_FIPPA_ACT_URL = "https://www.ontario.ca/laws/statute/90f31";

export function AppFooter() {
  useTr();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = useLocation({ select: (s) => s.pathname });
  const os = useOs();
  const modLabel = os === "macos" ? "⌘" : "Ctrl";
  const flourish = seasonalFlourish();

  return (
    <Box
      component="footer"
      mt={isMobile ? 20 : 28}
      pt={isMobile ? 14 : 18}
      pb="max(14px, env(safe-area-inset-bottom))"
      style={{
        alignSelf: "stretch",
      }}
    >
      <Box
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: isMobile ? 12 : 20,
          paddingRight: isMobile ? 12 : 20,
        }}
      >
        <Stack gap="lg" align="center">
          <Group gap={12} wrap="wrap" justify="center" align="baseline">
            <Anchor
              href="https://github.com/uoplan/uoplan"
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
            <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
              ·
            </Text>
            <Text
              component={Link}
              to="/changelog"
              state={{ back: { to: pathname, label: labelForPath(pathname) } } as never}
              size="sm"
              c="dimmed"
              lh={1.45}
              className="app-footer-link"
              style={{
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              {tr("app.footer.changelog")}
            </Text>
            <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
              ·
            </Text>
            <UnstyledButton
              onClick={() => useCommandCenterStore.getState().requestOpen()}
              aria-label={tr("app.footer.commandCenter")}
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
            <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
              ·
            </Text>
            <Text span size="xs" c="dimmed" ff="monospace" lh={1.45}>
              {(typeof __BRANCH_NAME__ !== "undefined" && __BRANCH_NAME__
                ? __BRANCH_NAME__
                : tr("app.footer.buildBranchFallback")
              ).toLowerCase()}
              {" · "}
              {(typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev").toLowerCase()}
            </Text>
            {flourish ? (
              <>
                <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                  ·
                </Text>
                <Text span size="xs" c="dimmed" lh={1.45}>
                  <span aria-hidden>{flourish.emoji}</span> {tr(flourish.msgId)}
                </Text>
              </>
            ) : null}
            <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
              ·
            </Text>
            <Text span size="sm" c="dimmed" lh={1.45}>
              {tr("app.footer.feedbackPrompt")}{" "}
              <Anchor href="mailto:admin@uoplan.party" size="sm" c="dimmed" underline="hover">
                admin@uoplan.party
              </Anchor>
            </Text>
          </Group>

          <Box
            role="note"
            style={{
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
              paddingTop: 2,
            }}
          >
            <Text
              size="sm"
              lh={1.65}
              ta="center"
              style={{
                fontStyle: "italic",
                letterSpacing: "0.01em",
                color: "var(--app-text-dim)",
              }}
            >
              {tr("app.footer.gradeDataAttribution.before")}
              <Anchor
                href={ONTARIO_FIPPA_ACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                display="inline"
                fz="sm"
                lh={1.65}
                underline="hover"
                className="app-footer-link"
                style={{
                  fontStyle: "italic",
                  letterSpacing: "0.01em",
                  color: "var(--app-text-dim)",
                }}
              >
                {tr("app.footer.gradeDataAttribution.actLink")}
              </Anchor>
              {tr("app.footer.gradeDataAttribution.after")}
            </Text>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

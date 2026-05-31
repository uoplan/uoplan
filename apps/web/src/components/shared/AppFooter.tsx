import { useLingui } from "@lingui/react";
import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Link, useLocation } from "@tanstack/react-router";
import { tr } from "../../i18n";
import { labelForPath } from "../../lib/navigation/backState";

const ONTARIO_FIPPA_ACT_URL = "https://www.ontario.ca/laws/statute/90f31";

export function AppFooter() {
  useLingui();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = useLocation({ select: (s) => s.pathname });

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
              styles={{
                root: {
                  "&:hover": {
                    color: "var(--mantine-color-gray-4)",
                    textDecoration: "underline",
                  },
                },
              }}
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
              style={{
                textDecoration: "none",
                cursor: "pointer",
              }}
              styles={{
                root: {
                  "&:hover": {
                    color: "var(--mantine-color-gray-4)",
                    textDecoration: "underline",
                  },
                },
              }}
            >
              {tr("app.footer.changelog")}
            </Text>
            <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
              ·
            </Text>
            <Text span size="xs" c="dimmed" ff="monospace" lh={1.45} style={{ opacity: 0.85 }}>
              {(typeof __BRANCH_NAME__ !== "undefined" && __BRANCH_NAME__
                ? __BRANCH_NAME__
                : tr("app.footer.buildBranchFallback")
              ).toLowerCase()}
              {" · "}
              {(typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev").toLowerCase()}
            </Text>
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
                style={{
                  fontStyle: "italic",
                  letterSpacing: "0.01em",
                  color: "var(--app-text-dim)",
                }}
                styles={{
                  root: {
                    "&:hover": {
                      color: "var(--mantine-color-gray-4)",
                    },
                  },
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

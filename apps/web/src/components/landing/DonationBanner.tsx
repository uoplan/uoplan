import { Link } from "@tanstack/react-router";
import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { IconArrowRight, IconHeartFilled, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { tr } from "../../i18n";
import classes from "./DonationBanner.module.css";

export function DonationBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <Box
      component="aside"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 960,
        marginLeft: "auto",
        marginRight: "auto",
        marginBottom: 12,
      }}
    >
      <Box
        component={Link}
        to="/donate"
        state={{ back: { to: "/", label: tr("app.nav.backHome") } } as never}
        className={classes.banner}
        style={{
          display: "block",
          textDecoration: "none",
          background: "var(--app-accent-soft)",
          borderRadius: "var(--app-radius-lg)",
        }}
      >
        <Group
          wrap="nowrap"
          gap="sm"
          align="center"
          className={classes.row}
          style={{ padding: "10px 48px 10px 16px" }}
        >
          <Box
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              color: "var(--app-accent)",
              flexShrink: 0,
            }}
          >
            <IconHeartFilled size={18} />
          </Box>

          <Text
            size="sm"
            c="var(--app-text)"
            className={classes.textFull}
            style={{ flex: 1, minWidth: 0 }}
          >
            {tr("landing.donate.text")}
          </Text>

          <Text
            size="sm"
            c="var(--app-text)"
            className={classes.textShort}
            style={{ flex: 1, minWidth: 0 }}
          >
            {tr("landing.donate.textShort")}
          </Text>

          <Box
            aria-hidden
            className={classes.cta}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--app-accent)",
              color: "var(--app-on-accent)",
              borderRadius: "var(--app-radius-pill)",
              padding: "7px 16px",
              fontSize: "var(--mantine-font-size-sm)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {tr("landing.donate.cta")}
            <IconArrowRight className={classes.arrow} size={16} stroke={2} />
          </Box>
        </Group>
      </Box>

      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={tr("landing.donate.dismiss")}
        onClick={() => setVisible(false)}
        style={{
          position: "absolute",
          top: "50%",
          right: 12,
          transform: "translateY(-50%)",
          color: "var(--app-text-muted)",
        }}
      >
        <IconX size={16} />
      </ActionIcon>
    </Box>
  );
}

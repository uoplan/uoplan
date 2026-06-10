import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

const accentBlue: MantineColorsTuple = [
  "oklch(0.9705 0.0142 254.6)",
  "oklch(0.9319 0.0316 255.59)",
  "oklch(0.8823 0.0571 254.13)",
  "oklch(0.8091 0.0956 251.81)",
  "oklch(0.7137 0.1434 254.62)",
  "oklch(0.6231 0.188 259.81)",
  "oklch(0.5461 0.2152 262.88)",
  "oklch(0.4882 0.2172 264.38)",
  "oklch(0.4244 0.1809 265.64)",
  "oklch(0.3791 0.1378 265.52)",
];

const constructBlack: MantineColorsTuple = [
  "oklch(0.9618 0.0086 84.57)",
  "oklch(0.9198 0.0116 84.58)",
  "oklch(0.8557 0.0147 84.59)",
  "oklch(0.7651 0.0181 84.59)",
  "oklch(0.6721 0.0205 83.05)",
  "oklch(0.5591 0.0161 74.31)",
  "oklch(0.4534 0.017 74.23)",
  "oklch(0.3438 0.0124 72.42)",
  "oklch(0.2178 0 0)",
  "oklch(0.1591 0 0)",
];

const constructRed: MantineColorsTuple = [
  "oklch(0.9669 0.0162 17.44)",
  "oklch(0.9322 0.0343 17.78)",
  "oklch(0.8793 0.0641 18.45)",
  "oklch(0.8266 0.0967 19.33)",
  "oklch(0.7726 0.1257 20.36)",
  "oklch(0.7177 0.143 21.26)",
  "oklch(0.6609 0.1493 21.99)",
  "oklch(0.5953 0.1487 22.69)",
  "oklch(0.5303 0.1369 22.95)",
  "oklch(0.4616 0.1186 22.91)",
];

const constructGreen: MantineColorsTuple = [
  "oklch(0.9777 0.0156 154.48)",
  "oklch(0.951 0.0338 154.85)",
  "oklch(0.9006 0.0621 154.31)",
  "oklch(0.847 0.0926 153.67)",
  "oklch(0.7929 0.1147 152.83)",
  "oklch(0.7348 0.127 152.11)",
  "oklch(0.6661 0.1271 151.87)",
  "oklch(0.5849 0.1159 151.69)",
  "oklch(0.5065 0.099 152)",
  "oklch(0.4348 0.0829 152.32)",
];

export const theme = createTheme({
  defaultRadius: "md",
  primaryColor: "constructBlack",
  radius: {
    xs: rem(6),
    sm: rem(8),
    md: rem(12),
    lg: rem(18),
    xl: rem(24),
  },
  colors: {
    accentBlue,
    constructBlack,
    constructRed,
    constructGreen,
  },
  fontFamily: "var(--app-font-body)",
  headings: {
    fontFamily: "var(--app-font-heading)",
    fontWeight: "400",
  },
  components: {
    Button: {
      defaultProps: {
        variant: "filled",
        radius: "md",
      },
      styles: () => ({
        root: {
          fontWeight: 600,
          letterSpacing: "0.01em",
          transition: "transform var(--app-transition), box-shadow var(--app-transition)",
        },
      }),
    },
    Card: {
      defaultProps: {
        radius: "md",
      },
      styles: () => ({
        root: {
          border: "var(--app-border-width) solid var(--app-border)",
        },
      }),
    },
    Modal: {
      defaultProps: {
        removeScrollProps: { removeScrollBar: false },
        radius: "lg",
      },
      styles: () => ({
        content: {
          border: "var(--app-border-width) solid var(--app-border)",
          borderRadius: "var(--app-radius-lg)",
          boxShadow: "var(--app-shadow-lg)",
        },
        header: {
          borderBottom: "var(--app-border-width) solid var(--app-border)",
        },
        body: {
          paddingTop: rem(16),
        },
      }),
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
      styles: () => ({
        root: {
          fontFamily: "var(--app-font-body)",
          fontWeight: 600,
          letterSpacing: "0.01em",
          textTransform: "none" as const,
        },
      }),
    },
    Table: {
      styles: () => ({
        th: {
          borderBottom: "var(--app-border-width) solid var(--app-border-strong)",
          fontFamily: "var(--app-font-body)",
          fontSize: rem(11),
          letterSpacing: "0.04em",
          fontWeight: 600,
        },
        td: {
          borderBottom: "var(--app-border-width) solid var(--app-border)",
        },
      }),
    },
    Drawer: {
      styles: () => ({
        content: {
          borderLeft: "var(--app-border-width) solid var(--app-border)",
        },
        header: {
          borderBottom: "var(--app-border-width) solid var(--app-border)",
        },
      }),
    },
    Tooltip: {
      styles: () => ({
        tooltip: {
          backgroundColor: "var(--app-surface-overlay)",
          color: "var(--app-text)",
          border: "var(--app-border-width) solid var(--app-border-strong)",
          borderRadius: "var(--app-radius-sm)",
          fontWeight: 500,
        },
        arrow: {
          backgroundColor: "var(--app-surface-overlay)",
          border: "var(--app-border-width) solid var(--app-border-strong)",
        },
      }),
    },
  },
});

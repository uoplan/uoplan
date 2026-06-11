import { createTheme, rem } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";

const accentBlue: MantineColorsTuple = [
  "oklch(0.9705 0.0142 254.6)",
  "oklch(0.9319 0.0316 255.59)",
  "oklch(0.8823 0.0571 254.13)",
  "oklch(0.8091 0.0956 251.81)",
  "oklch(0.7137 0.1434 254.62)",
  "oklch(0.635 0.16 259.81)",
  "oklch(0.56 0.18 262.88)",
  "oklch(0.5 0.185 264.38)",
  "oklch(0.435 0.16 265.64)",
  "oklch(0.385 0.125 265.52)",
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
  "oklch(0.968 0.013 17.4)",
  "oklch(0.934 0.027 17.8)",
  "oklch(0.882 0.051 18.45)",
  "oklch(0.83 0.077 19.33)",
  "oklch(0.78 0.10 20.36)",
  "oklch(0.735 0.115 21.26)",
  "oklch(0.685 0.12 21.99)",
  "oklch(0.62 0.12 22.69)",
  "oklch(0.55 0.11 22.95)",
  "oklch(0.48 0.095 22.91)",
];

const constructGreen: MantineColorsTuple = [
  "oklch(0.978 0.013 154.48)",
  "oklch(0.952 0.028 154.85)",
  "oklch(0.903 0.051 154.31)",
  "oklch(0.852 0.077 153.67)",
  "oklch(0.80 0.095 152.83)",
  "oklch(0.745 0.107 152.11)",
  "oklch(0.685 0.11 151.87)",
  "oklch(0.60 0.10 151.69)",
  "oklch(0.52 0.086 152)",
  "oklch(0.445 0.072 152.32)",
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

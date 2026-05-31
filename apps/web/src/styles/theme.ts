import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

const accentBlue: MantineColorsTuple = [
  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

const constructBlack: MantineColorsTuple = [
  "#F5F2EC",
  "#E8E4DC",
  "#D4CFC5",
  "#B8B2A6",
  "#9C9588",
  "#7A736A",
  "#5C554C",
  "#3D3832",
  "#1A1A1A",
  "#0D0D0D",
];

const constructRed: MantineColorsTuple = [
  "#FFF0F0",
  "#FFE0E0",
  "#FFC7C7",
  "#FFADAD",
  "#FB9393",
  "#F07C7C",
  "#DF6868",
  "#C85454",
  "#AD4545",
  "#8F3838",
];

const constructGreen: MantineColorsTuple = [
  "#F0FBF3",
  "#DEF6E5",
  "#BFEBCC",
  "#9DDFB1",
  "#7FD198",
  "#65C081",
  "#4FAA6C",
  "#3E8F58",
  "#327548",
  "#285E3A",
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
          "&:hover": {
            transform: "var(--app-lift-hover)",
            boxShadow: "var(--app-shadow)",
          },
          "&:active": {
            transform: "translateY(0)",
            boxShadow: "var(--app-shadow-sm)",
          },
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
    Input: {
      styles: () => ({
        input: {
          border: "var(--app-border-width) solid var(--app-border-strong)",
          borderRadius: "var(--app-radius-sm)",
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    TextInput: {
      styles: () => ({
        input: {
          border: "var(--app-border-width) solid var(--app-border-strong)",
          borderRadius: "var(--app-radius-sm)",
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    PasswordInput: {
      styles: () => ({
        input: {
          border: "var(--app-border-width) solid var(--app-border-strong)",
          borderRadius: "var(--app-radius-sm)",
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    Select: {
      styles: () => ({
        input: {
          border: "var(--app-border-width) solid var(--app-border-strong)",
          borderRadius: "var(--app-radius-sm)",
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
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

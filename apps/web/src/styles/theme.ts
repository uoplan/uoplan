import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

const accentPurple: MantineColorsTuple = [
  "#FAF5FE",
  "#F1E6FB",
  "#E4CDF6",
  "#D5B2F0",
  "#C99DF0",
  "#BC88E8",
  "#A96FD9",
  "#9457C2",
  "#7E47A8",
  "#693A8C",
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
  defaultRadius: 0,
  primaryColor: "constructBlack",
  colors: {
    accentPurple,
    constructBlack,
    constructRed,
    constructGreen,
  },
  fontFamily: '"DM Mono", monospace',
  headings: {
    fontFamily: '"DM Serif Display", serif',
    fontWeight: "400",
  },
  components: {
    Button: {
      defaultProps: {
        variant: "filled",
        radius: 0,
      },
      styles: () => ({
        root: {
          textTransform: "uppercase" as const,
          fontWeight: 500,
          letterSpacing: "0.05em",
          transition: "transform 80ms ease, box-shadow 80ms ease",
          "&:hover": {
            transform: "rotate(-1deg) scale(1.02)",
            boxShadow: "3px 3px 0px var(--app-stamp-shadow)",
          },
          "&:active": {
            transform: "rotate(0deg) scale(0.98)",
            boxShadow: "none",
          },
        },
      }),
    },
    Card: {
      styles: () => ({
        root: {
          border: "2px solid var(--app-ink)",
        },
      }),
    },
    Input: {
      styles: () => ({
        input: {
          border: "1px solid var(--app-border-strong)",
          borderRadius: 0,
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    TextInput: {
      styles: () => ({
        input: {
          border: "1px solid var(--app-border-strong)",
          borderRadius: 0,
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    PasswordInput: {
      styles: () => ({
        input: {
          border: "1px solid var(--app-border-strong)",
          borderRadius: 0,
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    Select: {
      styles: () => ({
        input: {
          border: "1px solid var(--app-border-strong)",
          borderRadius: 0,
          "&:focus": {
            borderColor: "var(--app-focus-ring)",
          },
        },
      }),
    },
    Modal: {
      defaultProps: {
        removeScrollProps: { removeScrollBar: false },
      },
      styles: () => ({
        content: {
          border: "2px solid var(--app-ink)",
          borderRadius: 0,
        },
        header: {
          borderBottom: "2px solid var(--app-ink)",
        },
        body: {
          paddingTop: rem(16),
        },
      }),
    },
    Badge: {
      styles: () => ({
        root: {
          borderRadius: 0,
          textTransform: "uppercase" as const,
          fontFamily: '"DM Mono", monospace',
          fontWeight: 500,
          letterSpacing: "0.05em",
        },
      }),
    },
    Table: {
      styles: () => ({
        th: {
          borderBottom: "2px solid var(--app-ink)",
          textTransform: "uppercase" as const,
          fontFamily: '"DM Mono", monospace',
          fontSize: rem(11),
          letterSpacing: "0.08em",
          fontWeight: 500,
        },
        td: {
          borderBottom: "1px solid var(--app-border)",
        },
      }),
    },
    Drawer: {
      styles: () => ({
        content: {
          borderLeft: "2px solid var(--app-ink)",
        },
        header: {
          borderBottom: "2px solid var(--app-ink)",
        },
      }),
    },
    Tooltip: {
      styles: () => ({
        tooltip: {
          backgroundColor: "var(--app-surface-overlay)",
          color: "var(--app-text)",
          border: "1px solid var(--app-border-strong)",
          borderRadius: 0,
          fontWeight: 500,
        },
        arrow: {
          backgroundColor: "var(--app-surface-overlay)",
          border: "1px solid var(--app-border-strong)",
        },
      }),
    },
  },
});

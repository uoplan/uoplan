import { UnstyledButton } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { tr } from "../../i18n";
import { useAppTheme } from "../../theme/AppThemeProvider";
import type { ThemeSelection } from "../../theme/themes";
import {
  applyPillHover,
  pillButtonStyle,
  pillIconStyle,
  pillLabelStyle,
  resetPillHover,
} from "./pillButtonStyle";

/** Order the switcher cycles through on each click. */
const CYCLE: ThemeSelection[] = ["system", "light", "dark"];

const LABEL_ID: Record<ThemeSelection, string> = {
  system: "theme.system",
  light: "theme.light",
  dark: "theme.dark",
};

function iconFor(selection: ThemeSelection) {
  if (selection === "light") return <IconSun size={14} style={pillIconStyle} />;
  if (selection === "dark") return <IconMoon size={14} style={pillIconStyle} />;
  return <IconDeviceDesktop size={14} style={pillIconStyle} />;
}

export function ThemeSwitcher() {
  useLingui();
  const { selection, setSelection } = useAppTheme();

  const current: ThemeSelection = CYCLE.includes(selection) ? selection : "system";

  const next = () => {
    const idx = CYCLE.indexOf(current);
    setSelection(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const labelId = LABEL_ID[current] ?? "theme.system";

  return (
    <UnstyledButton
      aria-label={tr("themeSwitcher.ariaLabel")}
      onClick={next}
      style={pillButtonStyle}
      onMouseEnter={(e) => applyPillHover(e.currentTarget as HTMLButtonElement)}
      onMouseLeave={(e) => resetPillHover(e.currentTarget as HTMLButtonElement)}
    >
      {iconFor(current)}
      <span style={pillLabelStyle}>{tr(labelId)}</span>
    </UnstyledButton>
  );
}

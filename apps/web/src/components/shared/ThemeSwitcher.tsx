import type { ReactNode } from "react";
import { IconBallFootball, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTr, tr } from "../../i18n";
import { useAppTheme } from "../../theme/appThemeContext";
import { isThemeVisible, type ThemeSelection } from "../../theme/themes";
import { PillSelect, type PillSelectOption } from "./PillSelect";
import { pillIconStyle } from "./pillButtonStyle";

function iconFor(selection: ThemeSelection): ReactNode {
  if (selection === "light") return <IconSun size={14} style={pillIconStyle} />;
  if (selection === "dark") return <IconMoon size={14} style={pillIconStyle} />;
  if (selection === "geegees") return <IconBallFootball size={14} style={pillIconStyle} />;
  return <IconDeviceDesktop size={14} style={pillIconStyle} />;
}

export function ThemeSwitcher() {
  useTr();
  const { selection, setSelection, themes, unlockedThemes } = useAppTheme();

  const options: PillSelectOption<ThemeSelection>[] = [
    { value: "system", label: tr("theme.system"), icon: iconFor("system") },
    ...themes
      .filter((theme) => isThemeVisible(theme, unlockedThemes))
      .map((theme) => ({
        value: theme.id,
        label: tr(theme.labelId),
        icon: iconFor(theme.id),
      })),
  ];

  return (
    <PillSelect
      options={options}
      value={selection}
      onChange={setSelection}
      ariaLabel={tr("themeSwitcher.ariaLabel")}
    />
  );
}

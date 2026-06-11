import { useLingui } from "@lingui/react";
import { IconWorld } from "@tabler/icons-react";
import { dynamicActivate, tr } from "../../i18n";
import type { AppLocale } from "../../i18n";
import { PillSelect } from "./PillSelect";
import type { PillSelectOption } from "./PillSelect";
import { pillIconStyle } from "./pillButtonStyle";

const NATIVE_LABEL: Record<AppLocale, string> = {
  en: "English",
  "fr-CA": "Français",
};

interface LanguageSwitcherProps {
  onSwitch?: (locale: AppLocale) => void | Promise<void>;
}

export function LanguageSwitcher({ onSwitch }: LanguageSwitcherProps) {
  const { i18n } = useLingui();
  const locale = (i18n.locale || "en") as AppLocale;

  const options: PillSelectOption<AppLocale>[] = (Object.keys(NATIVE_LABEL) as AppLocale[]).map(
    (value) => ({
      value,
      label: NATIVE_LABEL[value],
      icon: <IconWorld size={14} style={pillIconStyle} />,
    }),
  );

  return (
    <PillSelect
      options={options}
      value={locale}
      onChange={(next) => {
        if (onSwitch) void onSwitch(next);
        else void dynamicActivate(next);
      }}
      ariaLabel={tr("languageSwitcher.ariaLabel")}
    />
  );
}

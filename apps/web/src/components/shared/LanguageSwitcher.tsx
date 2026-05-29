import { useLingui } from "@lingui/react";
import { IconWorld } from "@tabler/icons-react";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";
import { PillSelect, type PillSelectOption } from "./PillSelect";
import { pillIconStyle } from "./pillButtonStyle";

const LABEL_ID: Record<AppLocale, string> = {
  en: "language.en",
  "fr-CA": "language.frCA",
};

interface LanguageSwitcherProps {
  onSwitch?: (locale: AppLocale) => void | Promise<void>;
}

export function LanguageSwitcher({ onSwitch }: LanguageSwitcherProps) {
  const { i18n } = useLingui();
  const locale = (i18n.locale || "en") as AppLocale;

  const options: PillSelectOption<AppLocale>[] = (Object.keys(LABEL_ID) as AppLocale[]).map(
    (value) => ({
      value,
      label: tr(LABEL_ID[value]),
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

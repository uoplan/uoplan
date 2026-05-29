import { UnstyledButton } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { IconWorld } from "@tabler/icons-react";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";
import {
  applyPillHover,
  pillButtonStyle,
  pillIconStyle,
  pillLabelStyle,
  resetPillHover,
} from "./pillButtonStyle";

const NEXT: Record<AppLocale, AppLocale> = {
  en: "fr-CA",
  "fr-CA": "en",
};

const LABEL: Record<AppLocale, string> = {
  en: "EN",
  "fr-CA": "FR",
};

interface LanguageSwitcherProps {
  onSwitch?: (locale: AppLocale) => void | Promise<void>;
}

export function LanguageSwitcher({ onSwitch }: LanguageSwitcherProps) {
  const { i18n } = useLingui();
  const locale = (i18n.locale || "en") as AppLocale;
  const next = NEXT[locale];

  return (
    <UnstyledButton
      aria-label={tr("languageSwitcher.ariaLabel")}
      onClick={() => {
        if (onSwitch) void onSwitch(next);
        else void dynamicActivate(next);
      }}
      style={pillButtonStyle}
      onMouseEnter={(e) => applyPillHover(e.currentTarget as HTMLButtonElement)}
      onMouseLeave={(e) => resetPillHover(e.currentTarget as HTMLButtonElement)}
    >
      <IconWorld size={14} style={pillIconStyle} />
      <span style={pillLabelStyle}>{LABEL[next]}</span>
    </UnstyledButton>
  );
}

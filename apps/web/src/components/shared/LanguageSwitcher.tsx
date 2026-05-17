import { UnstyledButton } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { IconWorld } from "@tabler/icons-react";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 999,
        padding: "5px 10px 5px 8px",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
      }}
    >
      <IconWorld size={14} style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.07em",
          color: "#F8F9FA",
          userSelect: "none",
        }}
      >
        {LABEL[next]}
      </span>
    </UnstyledButton>
  );
}

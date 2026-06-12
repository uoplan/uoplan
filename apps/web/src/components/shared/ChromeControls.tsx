import { useState } from "react";
import { Box, Group, Tooltip } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import { IconSettings, IconUserCircle } from "@tabler/icons-react";
import { AnimatePresence, m } from "framer-motion";
import { tr, useTr } from "../../i18n";
import type { AppLocale } from "../../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { applyPillHover, pillButtonStyle, pillIconStyle, resetPillHover } from "./pillButtonStyle";

interface ChromeControlsProps {
  onLangSwitch?: (locale: AppLocale) => void | Promise<void>;
}

/**
 * Chrome controls (theme + language switchers). On wide viewports they sit
 * inline; on narrow viewports they collapse behind a settings button that
 * reveals a small floating menu, dropping the two switchers in right beneath
 * it so they never crowd the page content.
 */
export function ChromeControls({ onLangSwitch }: ChromeControlsProps) {
  useTr();
  const [opened, setOpened] = useState(false);
  const containerRef = useClickOutside(() => setOpened(false));

  return (
    <>
      <Group gap={8} visibleFrom="sm">
        <Tooltip label={tr("app.nav.dest.personalize.label")} position="bottom" withArrow>
          <Link
            to="/personalize"
            aria-label={tr("app.nav.dest.personalize.label")}
            style={{
              ...pillButtonStyle,
              padding: 0,
              width: 32,
              height: 32,
              justifyContent: "center",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => applyPillHover(e.currentTarget)}
            onMouseLeave={(e) => resetPillHover(e.currentTarget)}
          >
            <IconUserCircle size={16} style={pillIconStyle} />
          </Link>
        </Tooltip>
        <ThemeSwitcher />
        <LanguageSwitcher onSwitch={onLangSwitch} />
      </Group>

      <Box hiddenFrom="sm" ref={containerRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-label={tr("settings.ariaLabel")}
          aria-expanded={opened}
          onClick={() => setOpened((value) => !value)}
          style={{
            ...pillButtonStyle,
            padding: 0,
            width: 32,
            height: 32,
            justifyContent: "center",
          }}
          onMouseEnter={(e) => applyPillHover(e.currentTarget)}
          onMouseLeave={(e) => resetPillHover(e.currentTarget)}
        >
          <m.span
            animate={{ rotate: opened ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ display: "flex" }}
          >
            <IconSettings size={16} style={pillIconStyle} />
          </m.span>
        </button>

        <AnimatePresence>
          {opened ? (
            <m.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 20,
                transformOrigin: "top right",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <ThemeSwitcher />
              <LanguageSwitcher onSwitch={onLangSwitch} />
            </m.div>
          ) : null}
        </AnimatePresence>
      </Box>
    </>
  );
}

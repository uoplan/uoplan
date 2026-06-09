import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import type { CSSVariablesResolver } from "@mantine/core";
import { theme } from "../styles/theme";
import {
  type ColorSchemeBase,
  type ThemeId,
  type ThemeSelection,
  THEME_LIST,
  getSystemBase,
  persistSelection,
  persistUnlockedTheme,
  readStoredSelection,
  readUnlockedThemes,
  resolveTheme,
} from "./themes";
import { AppThemeContext, type AppThemeContextValue } from "./appThemeContext";

/**
 * Map Mantine's surface/text variables onto our semantic tokens so Mantine's
 * own components (Menu, Popover, Modal bodies, default inputs, dimmed text)
 * follow the active theme without per-component overrides. The tokens already
 * switch via `data-app-theme`, so the same mapping works for every scheme.
 */
const mantineTokenMap = {
  "--mantine-color-body": "var(--app-bg)",
  "--mantine-color-text": "var(--app-text)",
  "--mantine-color-dimmed": "var(--app-text-dim)",
  "--mantine-color-default": "var(--app-surface)",
  "--mantine-color-default-hover": "var(--app-surface-hover)",
  "--mantine-color-default-border": "var(--app-border)",
  "--mantine-color-placeholder": "var(--app-text-dim)",
} as const;

// The map is also emitted into Mantine's scheme-specific blocks (`light`/`dark`)
// so scheme-scoped defaults like `--mantine-color-dimmed` (which Mantine sets
// under `[data-mantine-color-scheme]`) don't win on specificity and leave
// `c="dimmed"` / placeholders stuck on Mantine's low-contrast greys.
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: mantineTokenMap,
  light: mantineTokenMap,
  dark: mantineTokenMap,
});

interface AppThemeProviderProps {
  children: ReactNode;
  /** Override the initial selection (mainly for tests). */
  initialSelection?: ThemeSelection;
}

/**
 * Owns the app's theme selection (single source of truth), applies it as a
 * `data-app-theme` attribute on <html>, keeps Mantine's color scheme aligned,
 * and exposes the selection via {@link useAppTheme}.
 */
export function AppThemeProvider({ children, initialSelection }: AppThemeProviderProps) {
  const [selection, setSelectionState] = useState<ThemeSelection>(
    () => initialSelection ?? readStoredSelection(),
  );
  const [systemBase, setSystemBase] = useState<ColorSchemeBase>(() => getSystemBase());
  const [unlockedThemes, setUnlockedThemes] = useState<ThemeId[]>(() => readUnlockedThemes());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemBase(e.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved = useMemo(() => resolveTheme(selection, systemBase), [selection, systemBase]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-app-theme", resolved.id);
  }, [resolved.id]);

  const setSelection = useCallback((next: ThemeSelection) => {
    persistSelection(next);
    setSelectionState(next);
  }, []);

  const unlockTheme = useCallback((id: ThemeId) => {
    setUnlockedThemes(persistUnlockedTheme(id));
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({ selection, resolved, themes: THEME_LIST, unlockedThemes, setSelection, unlockTheme }),
    [selection, resolved, unlockedThemes, setSelection, unlockTheme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <MantineProvider
        theme={theme}
        forceColorScheme={resolved.base}
        cssVariablesResolver={cssVariablesResolver}
      >
        {children}
      </MantineProvider>
    </AppThemeContext.Provider>
  );
}

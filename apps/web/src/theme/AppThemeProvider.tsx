import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import type { CSSVariablesResolver } from "@mantine/core";
import { theme } from "../styles/theme";
import {
  type AppTheme,
  type ColorSchemeBase,
  type ThemeSelection,
  THEME_LIST,
  getSystemBase,
  persistSelection,
  readStoredSelection,
  resolveTheme,
} from "./themes";

interface AppThemeContextValue {
  /** Current user selection ("system" or a theme id). */
  selection: ThemeSelection;
  /** The concrete theme currently applied. */
  resolved: AppTheme;
  /** All registered themes (for building a switcher). */
  themes: AppTheme[];
  /** Persist and apply a new selection. */
  setSelection: (selection: ThemeSelection) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/**
 * Map Mantine's surface/text variables onto our semantic tokens so Mantine's
 * own components (Menu, Popover, Modal bodies, default inputs, dimmed text)
 * follow the active theme without per-component overrides. The tokens already
 * switch via `data-app-theme`, so the same mapping works for every scheme.
 */
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-body": "var(--app-bg)",
    "--mantine-color-text": "var(--app-text)",
    "--mantine-color-dimmed": "var(--app-text-dim)",
    "--mantine-color-default": "var(--app-surface)",
    "--mantine-color-default-hover": "var(--app-surface-hover)",
    "--mantine-color-default-border": "var(--app-border)",
    "--mantine-color-placeholder": "var(--app-text-dim)",
  },
  light: {},
  dark: {},
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

  const value = useMemo<AppThemeContextValue>(
    () => ({ selection, resolved, themes: THEME_LIST, setSelection }),
    [selection, resolved, setSelection],
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

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }
  return ctx;
}

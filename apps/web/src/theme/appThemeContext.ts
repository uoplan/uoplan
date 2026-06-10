import { createContext, useContext } from "react";
import type { AppTheme, ThemeSelection } from "./themes";

export interface AppThemeContextValue {
  /** Current user selection ("system" or a theme id). */
  selection: ThemeSelection;
  /** The concrete theme currently applied. */
  resolved: AppTheme;
  /** All registered themes (for building a switcher). */
  themes: AppTheme[];
  /** Persist and apply a new selection. */
  setSelection: (selection: ThemeSelection) => void;
}

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }
  return ctx;
}

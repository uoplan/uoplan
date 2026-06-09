import { createContext, useContext } from "react";
import type { AppTheme, ThemeId, ThemeSelection } from "./themes";

export interface AppThemeContextValue {
  /** Current user selection ("system" or a theme id). */
  selection: ThemeSelection;
  /** The concrete theme currently applied. */
  resolved: AppTheme;
  /** All registered themes (for building a switcher). */
  themes: AppTheme[];
  /** Hidden theme ids the user has unlocked (easter eggs). */
  unlockedThemes: ThemeId[];
  /** Persist and apply a new selection. */
  setSelection: (selection: ThemeSelection) => void;
  /** Unlock a hidden (easter-egg) theme so it appears in the switcher. */
  unlockTheme: (id: ThemeId) => void;
}

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }
  return ctx;
}

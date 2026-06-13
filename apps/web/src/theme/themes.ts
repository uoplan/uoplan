import "../styles/tokens.css";

import { isThemeId, THEME_STORAGE_KEY } from "@uoplan/theme";
import type { ColorSchemeBase, ThemeSelection } from "@uoplan/theme";

// Re-export the platform-agnostic theme model so existing `./themes` importers
// keep working unchanged. The registry + resolution logic now lives in
// `@uoplan/theme` (shared with the native app); only the web-specific I/O below
// (matchMedia / localStorage) stays here.
export * from "@uoplan/theme";

/** Read the OS colour-scheme preference (defaults to dark when unavailable). */
export function getSystemBase(): ColorSchemeBase {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Read the persisted selection, falling back to "system". */
export function readStoredSelection(): ThemeSelection {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "system") return "system";
    if (raw && isThemeId(raw)) return raw;
  } catch {
    /* localStorage may be unavailable (private mode, etc.) */
  }
  return "system";
}

export function persistSelection(selection: ThemeSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, selection);
  } catch {
    /* ignore */
  }
}

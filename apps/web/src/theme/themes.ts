import "../styles/tokens.css";

/** A colour scheme understood by Mantine. Every app theme maps onto one. */
export type ColorSchemeBase = "light" | "dark";

/**
 * The id of a registered theme. Each value must have a matching
 * `[data-app-theme="<id>"]` block in tokens.css and an entry in {@link THEMES}.
 * Add a new theme by extending this union (the typed records below then force
 * you to register it everywhere it's needed).
 */
export type ThemeId = "dark" | "light" | "geegees";

/** A registered, concrete theme (one block in tokens.css). */
export interface AppTheme {
  /** Matches the `[data-app-theme="<id>"]` selector in tokens.css. */
  id: ThemeId;
  /** Short label shown in the switcher (also used as an i18n message id). */
  labelId: string;
  /** Base Mantine colour scheme this theme renders on top of. */
  base: ColorSchemeBase;
}

/**
 * Theme registry — the single list of selectable themes. Add an entry here
 * (and a matching block in tokens.css) to introduce a new theme.
 */
const THEMES: Record<ThemeId, AppTheme> = {
  dark: { id: "dark", labelId: "theme.dark", base: "dark" },
  light: { id: "light", labelId: "theme.light", base: "light" },
  geegees: { id: "geegees", labelId: "theme.geegees", base: "dark" },
};

export const THEME_LIST: AppTheme[] = Object.values(THEMES);

/**
 * Which theme each system colour-scheme preference resolves to when the user
 * selection is "system".
 */
const SYSTEM_THEME_MAP: Record<ColorSchemeBase, ThemeId> = {
  dark: "dark",
  light: "light",
};

/** The default theme id when system preference can't be determined. */
const DEFAULT_THEME_ID: ThemeId = "dark";

/** A user selection: either an explicit theme id or "follow system". */
export type ThemeSelection = "system" | ThemeId;

export const THEME_STORAGE_KEY = "uoplan.theme";

/** Narrow an arbitrary string to a registered {@link ThemeId}. */
function isThemeId(value: string): value is ThemeId {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}

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

/**
 * Resolve a selection (+ current system base) to a concrete theme.
 * "system" maps the OS preference through {@link SYSTEM_THEME_MAP}.
 */
export function resolveTheme(selection: ThemeSelection, systemBase: ColorSchemeBase): AppTheme {
  if (selection !== "system" && THEMES[selection]) {
    return THEMES[selection];
  }
  const id = SYSTEM_THEME_MAP[systemBase] ?? DEFAULT_THEME_ID;
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}

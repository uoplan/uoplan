/**
 * Platform-agnostic theme model — the shared source of truth for which themes
 * exist and how a user selection resolves to a concrete theme. This module has
 * **no** platform dependencies (no `window`, no DOM, no React, no CSS import), so
 * the web app (`apps/web`) and the native app (`apps/native`) consume the exact
 * same registry and resolution logic.
 *
 * Each theme's *rendered* values live per platform: the web renders them as the
 * `[data-app-theme="<id>"]` CSS-variable blocks in `apps/web/src/styles/
 * tokens.css`; native will map them to a JS theme object. The token **names**
 * both platforms must honour are enumerated in `./tokens`.
 *
 * Platform I/O (reading the OS colour-scheme preference, persisting the
 * selection) is intentionally NOT here — it differs per platform (web:
 * `matchMedia` + `localStorage`; native: `Appearance` + async storage) and is
 * supplied by each app's shell.
 */

/** A colour scheme understood by the underlying UI kit. Every app theme maps onto one. */
export type ColorSchemeBase = "light" | "dark";

/**
 * The id of a registered theme. Each value must have a matching rendering on
 * every platform (a `[data-app-theme="<id>"]` block on web) and an entry in the
 * theme registry below. Add a new theme by extending this union — the typed
 * records below then force you to register it everywhere it's needed.
 */
export type ThemeId = "dark" | "light" | "geegees";

/** A registered, concrete theme. */
export interface AppTheme {
  /** Matches the `[data-app-theme="<id>"]` selector on web. */
  id: ThemeId;
  /** Short label shown in the switcher (also used as an i18n message id). */
  labelId: string;
  /** Base colour scheme this theme renders on top of. */
  base: ColorSchemeBase;
}

/**
 * Theme registry — the single list of selectable themes. Add an entry here (and
 * the matching per-platform rendering) to introduce a new theme.
 */
const THEMES: Record<ThemeId, AppTheme> = {
  dark: { id: "dark", labelId: "theme.dark", base: "dark" },
  light: { id: "light", labelId: "theme.light", base: "light" },
  geegees: { id: "geegees", labelId: "theme.geegees", base: "dark" },
};

/** All registered themes, in registration order (for building a switcher). */
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

/** Storage key under which the user's {@link ThemeSelection} is persisted. */
export const THEME_STORAGE_KEY = "uoplan.theme";

/** Narrow an arbitrary string to a registered {@link ThemeId}. */
export function isThemeId(value: string): value is ThemeId {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}

/**
 * Resolve a selection (+ current system base) to a concrete theme.
 * "system" maps the OS preference through {@link SYSTEM_THEME_MAP}; an unknown
 * selection (e.g. a stale persisted id) falls back the same way.
 */
export function resolveTheme(selection: ThemeSelection, systemBase: ColorSchemeBase): AppTheme {
  if (selection !== "system" && THEMES[selection]) {
    return THEMES[selection];
  }
  const id = SYSTEM_THEME_MAP[systemBase] ?? DEFAULT_THEME_ID;
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}

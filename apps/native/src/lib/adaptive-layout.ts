import { useWindowDimensions } from "react-native";

/**
 * Resolved responsive layout for the current window. Drives iPad/tablet
 * adaptation: a sidebar-style nav, multi-column content where a single column
 * would waste width, a wider centred content column, and form-sheet modals.
 */
export interface AdaptiveLayout {
  width: number;
  height: number;
  /** Window orientation derived from the current app window dimensions. */
  orientation: "portrait" | "landscape";
  /** Window is wider than it is tall. */
  isLandscape: boolean;
  /** Compact width windows keep phone-style single-column content. */
  isCompactWidth: boolean;
  /** Regular width windows can use tablet split or multi-column content. */
  isRegularWidth: boolean;
  /** Wide regular windows have enough room for dashboards and inspector-style panes. */
  isWide: boolean;
  /** Device idiom is a tablet (regular size class), based on the SHORTER side. */
  isTablet: boolean;
  /** How many content columns to lay out (1 on phones / narrow iPads, 2 otherwise). */
  columns: 1 | 2;
  /** Max width of the centred content column. */
  contentMaxWidth: number;
  /** Render navigation as an adaptive sidebar (iPadOS) rather than a bottom tab bar. */
  sidebar: boolean;
  /** Present modals as centred form sheets rather than full-height bottom sheets. */
  formSheet: boolean;
}

/**
 * A window whose shorter side is at least this wide is treated as a tablet.
 * Keyed off the SHORTER dimension so a landscape phone (wide but short) stays a
 * compact phone, while every iPad — even the mini (744pt short side) — is a tablet.
 */
export const TABLET_MIN_SHORT_SIDE = 600;
/** Below this window width a tablet still lays content out in a single column. */
export const TWO_COLUMN_MIN_WIDTH = 768;
export const WIDE_MIN_WIDTH = 1024;
export const PHONE_CONTENT_MAX_WIDTH = 800;
export const TABLET_CONTENT_MAX_WIDTH = 1100;

/**
 * Pure window → layout decision, split out from the hook so it is trivially
 * unit-testable across the iPhone/iPad form factors without rendering.
 */
export function resolveAdaptiveLayout(width: number, height: number): AdaptiveLayout {
  const isLandscape = width > height;
  const orientation = isLandscape ? "landscape" : "portrait";
  const isCompactWidth = width < TWO_COLUMN_MIN_WIDTH;
  const isRegularWidth = !isCompactWidth;
  const isWide = width >= WIDE_MIN_WIDTH;
  const isTablet = Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;
  const columns: 1 | 2 = isTablet && width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
  return {
    width,
    height,
    orientation,
    isLandscape,
    isCompactWidth,
    isRegularWidth,
    isWide,
    isTablet,
    columns,
    contentMaxWidth: isTablet ? TABLET_CONTENT_MAX_WIDTH : PHONE_CONTENT_MAX_WIDTH,
    sidebar: isTablet,
    formSheet: isTablet,
  };
}

/**
 * Live responsive layout for the current window. Re-renders on rotation / size
 * changes (e.g. iPad multitasking) via {@link useWindowDimensions}.
 */
export function useAdaptiveLayout(): AdaptiveLayout {
  const { width, height } = useWindowDimensions();
  return resolveAdaptiveLayout(width, height);
}

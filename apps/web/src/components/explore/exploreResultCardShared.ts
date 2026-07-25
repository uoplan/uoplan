import type { CSSProperties } from "react";

/**
 * Shared chrome for the four Explore search-result cards (course, professor,
 * program, discipline). The `<Link>` itself stays in each card because TanStack
 * Router types `to`/`params` per route, but everything route-agnostic lives here.
 */
export const EXPLORE_RESULT_CARD_STYLE: CSSProperties = {
  width: 190,
  minWidth: 190,
  position: "relative",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  minHeight: 155,
  backgroundColor: "var(--app-surface-sunken)",
  border: "var(--app-border-width) solid var(--app-border)",
  borderRadius: "var(--app-radius)",
  overflow: "hidden",
  textDecoration: "none",
  color: "inherit",
  transition:
    "background-color var(--app-transition), border-color var(--app-transition), transform var(--app-transition), box-shadow var(--app-transition)",
};

/**
 * Same card, stretched to its container. Search lays cards out in horizontally
 * scrolling rows (fixed width); the Explore landing browses them in a responsive
 * grid, where a fixed width would leave ragged gaps in every cell.
 */
export const EXPLORE_RESULT_CARD_FILL_STYLE: CSSProperties = {
  ...EXPLORE_RESULT_CARD_STYLE,
  width: "100%",
  minWidth: 0,
};

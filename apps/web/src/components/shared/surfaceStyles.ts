import type { CSSProperties } from "react";

/**
 * Shared cozy surface styles. These centralize the soft border / rounded-corner
 * / soft-shadow language so components stop hardcoding `border: "2px solid …"`
 * and `borderRadius: 0`. All values flow through `--app-*` tokens, so surfaces
 * adapt to the active theme automatically.
 */

/** A standard raised surface card (matches the default `<Card>` look). */
export const cardStyle: CSSProperties = {
  backgroundColor: "var(--app-surface)",
  border: "var(--app-border-width) solid var(--app-border)",
  borderRadius: "var(--app-radius)",
};

/** A recessed / inset surface (e.g. nested panels, list rows). */
export const sunkenCardStyle: CSSProperties = {
  backgroundColor: "var(--app-surface-sunken)",
  border: "var(--app-border-width) solid var(--app-border)",
  borderRadius: "var(--app-radius)",
};

/** An elevated overlay surface (e.g. floating panels, dropdowns). */
export const overlayCardStyle: CSSProperties = {
  backgroundColor: "var(--app-surface-overlay)",
  border: "var(--app-border-width) solid var(--app-border)",
  borderRadius: "var(--app-radius)",
  boxShadow: "var(--app-shadow)",
};

/**
 * Transition to pair with the `.soft-lift` class (or apply directly) so
 * interactive surfaces lift gently on hover instead of using the old stamp
 * rotate effect.
 */
export const interactiveCardStyle: CSSProperties = {
  ...cardStyle,
  cursor: "pointer",
  transition:
    "transform var(--app-transition), box-shadow var(--app-transition), border-color var(--app-transition)",
};

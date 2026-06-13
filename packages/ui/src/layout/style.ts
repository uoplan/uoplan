/**
 * Pure, platform-agnostic style-token resolution shared by the layout
 * primitives' web (Mantine) and native (React Native) implementations.
 *
 * The resolved CSS keyword strings (`flex-start`, `space-between`, …) are valid
 * in BOTH worlds: Mantine accepts `React.CSSProperties` values and React
 * Native's `alignItems` / `justifyContent` accept the same flexbox keywords, so
 * one mapper serves both adapters and the contract can never drift.
 */

export type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl";
/** A spacing value: a raw pixel number or a named scale step. */
export type Spacing = number | SpacingToken;

const SPACING_SCALE: Record<SpacingToken, number> = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Resolve a {@link Spacing} to pixels (numbers pass through). */
export function resolveSpacing(value: Spacing | undefined): number | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? value : SPACING_SCALE[value];
}

export type RadiusToken = "sm" | "md" | "lg" | "xl";
/** A border-radius value: a raw pixel number or a named scale step. */
export type Radius = number | RadiusToken;

const RADIUS_SCALE: Record<RadiusToken, number> = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/** Resolve a {@link Radius} to pixels (numbers pass through). */
export function resolveRadius(value: Radius | undefined): number | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? value : RADIUS_SCALE[value];
}

export type Align = "start" | "center" | "end" | "stretch";
export type Justify = "start" | "center" | "end" | "between" | "around";

type CssAlign = "flex-start" | "center" | "flex-end" | "stretch";
type CssJustify = "flex-start" | "center" | "flex-end" | "space-between" | "space-around";

const ALIGN: Record<Align, CssAlign> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const JUSTIFY: Record<Justify, CssJustify> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

/** Map the neutral cross-axis alignment token to a flexbox keyword. */
export function resolveAlign(value: Align | undefined): CssAlign | undefined {
  return value === undefined ? undefined : ALIGN[value];
}

/** Map the neutral main-axis distribution token to a flexbox keyword. */
export function resolveJustify(value: Justify | undefined): CssJustify | undefined {
  return value === undefined ? undefined : JUSTIFY[value];
}

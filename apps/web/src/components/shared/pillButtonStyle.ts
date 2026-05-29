import type { CSSProperties } from "react";

/**
 * Shared "glass pill" styling for the small chrome controls (language and
 * theme switchers) so they stay visually consistent. All colours are theme
 * tokens so the pills adapt to the active theme.
 */
export const pillButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "var(--app-translucent)",
  border: "1px solid var(--app-translucent-strong)",
  borderRadius: 999,
  padding: "5px 10px 5px 8px",
  backdropFilter: "blur(8px)",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

export function applyPillHover(el: HTMLElement): void {
  el.style.background = "var(--app-translucent-strong)";
  el.style.borderColor = "var(--app-translucent-strong)";
}

export function resetPillHover(el: HTMLElement): void {
  el.style.background = "var(--app-translucent)";
  el.style.borderColor = "var(--app-translucent-strong)";
}

export const pillLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  color: "var(--app-text)",
  userSelect: "none",
};

export const pillIconStyle: CSSProperties = {
  color: "var(--app-text-dim)",
  flexShrink: 0,
};

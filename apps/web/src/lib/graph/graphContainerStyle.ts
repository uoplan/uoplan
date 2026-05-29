import type { CSSProperties } from "react";

export function buildGraphContainerStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    background: "var(--app-bg)",
    touchAction: "none",
  };
}

import { Paper } from "@mantine/core";
import type { PaperProps } from "@mantine/core";
import { forwardRef, type ReactNode } from "react";

type AppCardVariant = "surface" | "sunken" | "overlay";

interface AppCardProps extends PaperProps {
  /** Which themed surface to render. Defaults to "surface". */
  variant?: AppCardVariant;
  /** Add the soft-lift hover affordance (for clickable cards). */
  interactive?: boolean;
  children?: ReactNode;
}

const VARIANT_BG: Record<AppCardVariant, string> = {
  surface: "var(--app-surface)",
  sunken: "var(--app-surface-sunken)",
  overlay: "var(--app-surface-overlay)",
};

/**
 * Cozy surface card. Centralizes the soft border / rounded-corner / soft-shadow
 * language so components don't hardcode `border: "2px solid …"` /
 * `borderRadius: 0`. Colours flow through `--app-*` tokens and adapt per theme.
 *
 * Pass `interactive` for clickable cards to get the gentle soft-lift on hover.
 */
export const AppCard = forwardRef<HTMLDivElement, AppCardProps>(function AppCard(
  { variant = "surface", interactive = false, className, style, children, ...rest },
  ref,
) {
  return (
    <Paper
      ref={ref}
      radius="md"
      className={interactive ? ["soft-lift", className].filter(Boolean).join(" ") : className}
      style={[
        {
          backgroundColor: VARIANT_BG[variant],
          border: "var(--app-border-width) solid var(--app-border)",
          boxShadow: variant === "overlay" ? "var(--app-shadow)" : undefined,
          ...(interactive ? { cursor: "pointer" } : null),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Paper>
  );
});

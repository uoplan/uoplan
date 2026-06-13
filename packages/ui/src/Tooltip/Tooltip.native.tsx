import type { TooltipProps } from "./Tooltip.types";

/**
 * Native (React Native) implementation of the Tooltip contract. Touch platforms
 * have no hover affordance, so the tooltip label is omitted and the target is
 * rendered as-is. Kept as a contract parity stub so shared screens can wrap
 * elements in <Tooltip> without branching per platform.
 */
export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

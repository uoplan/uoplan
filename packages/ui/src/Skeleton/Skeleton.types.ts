/**
 * Shared prop contract for the Skeleton primitive — a loading placeholder
 * block. Web maps onto Mantine's `Skeleton`; native maps onto a muted `View`.
 */
export interface SkeletonProps {
  /** Width in pixels or a CSS/percentage string. */
  width?: number | string;
  /** Height in pixels. */
  height?: number;
  /** Corner radius in pixels. */
  radius?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

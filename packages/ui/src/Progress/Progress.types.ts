/**
 * Shared prop contract for the Progress primitive — a horizontal progress bar.
 * Web maps onto Mantine's `Progress`; native maps onto a track + fill `View`.
 */
export interface ProgressProps {
  /** Completion percentage, 0–100. */
  value: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

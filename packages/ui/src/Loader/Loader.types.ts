export type LoaderSize = "sm" | "md" | "lg";

/**
 * Shared prop contract for the Loader primitive — a loading spinner. Web maps
 * onto Mantine's `Loader`; native maps onto a React Native `ActivityIndicator`.
 */
export interface LoaderProps {
  /** Spinner size. Defaults to `md`. */
  size?: LoaderSize;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

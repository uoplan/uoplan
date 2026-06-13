import type { SelectOption } from "../Radio/Radio.types";

/**
 * Shared prop contract for the SegmentedControl primitive — a single-select
 * inline switch. Web maps onto Mantine's `SegmentedControl`; native maps onto a
 * horizontal row of pressable segments. The change handler uses
 * `onChange(value)`.
 */
export interface SegmentedControlProps {
  /** Currently selected option value. */
  value?: string;
  /** Fired with the newly selected option value. */
  onChange?: (value: string) => void;
  /** The selectable segments. */
  data: SelectOption[];
  /** Stretch the control to fill its container. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

/** A single selectable option in a Radio / SegmentedControl group. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Shared prop contract for the Radio primitive — a single-select group of
 * options. Web maps onto Mantine's `Radio.Group` + `Radio`; native maps onto a
 * vertical stack of pressable rows. The change handler uses `onChange(value)`.
 */
export interface RadioProps {
  /** Currently selected option value. */
  value?: string;
  /** Fired with the newly selected option value. */
  onChange?: (value: string) => void;
  /** The selectable options. */
  data: SelectOption[];
  /** Group label. */
  label?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

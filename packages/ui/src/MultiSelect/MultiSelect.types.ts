import type { SelectOption } from "../Radio/Radio.types";

/**
 * Shared prop contract for the MultiSelect primitive — a multi-value dropdown.
 * Web maps onto Mantine's `MultiSelect`; native maps onto a pressable field that
 * opens a modal checklist. Options reuse the shared {@link SelectOption} model.
 * The change handler uses `onChange(values)` with the full selected array.
 */
export interface MultiSelectProps {
  /** Currently selected option values. */
  value?: string[];
  /** Fired with the full set of selected option values. */
  onChange?: (value: string[]) => void;
  /** The selectable options. */
  data: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

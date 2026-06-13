import type { SelectOption } from "../Radio/Radio.types";

/**
 * Shared prop contract for the Select primitive — a single-select dropdown. Web
 * maps onto Mantine's `Select`; native maps onto a pressable field that opens a
 * modal option list. Options reuse the shared {@link SelectOption} model. The
 * change handler uses `onChange(value)` where `value` is `null` when cleared.
 */
export interface SelectProps {
  /** Currently selected option value (or `null`). */
  value?: string | null;
  /** Fired with the newly selected option value. */
  onChange?: (value: string | null) => void;
  /** The selectable options. */
  data: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

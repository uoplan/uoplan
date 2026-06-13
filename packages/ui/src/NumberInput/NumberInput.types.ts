/**
 * Shared prop contract for the NumberInput primitive — a numeric field with
 * optional bounds. Web maps onto Mantine's `NumberInput`; native maps onto a
 * React Native `TextInput` with a numeric keyboard. The change handler uses the
 * neutral `onChange(value)` shape (value is `undefined` when the field is empty).
 */
export interface NumberInputProps {
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /** Fired with the parsed number (or `undefined` when cleared). */
  onChange?: (value?: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

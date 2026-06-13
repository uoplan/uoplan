/**
 * Shared prop contract for the Switch primitive — a boolean toggle. Web maps
 * onto Mantine's `Switch`; native maps onto a React Native `Switch`. The change
 * handler uses the neutral `onChange(checked)` shape.
 */
export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Fired with the new checked state on toggle. */
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

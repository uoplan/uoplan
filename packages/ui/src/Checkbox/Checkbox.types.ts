/**
 * Shared prop contract for the Checkbox primitive. Web maps onto Mantine's
 * `Checkbox`; native maps onto a pressable box. The change handler uses the
 * neutral `onChange(checked)` shape.
 */
export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Fired with the new checked state on toggle. */
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

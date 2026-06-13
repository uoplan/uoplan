/**
 * Shared prop contract for the TextInput primitive — a single-line text field.
 * Web maps onto Mantine's `TextInput`; native maps onto a React Native
 * `TextInput`. The change handler uses the neutral `onChangeText(text)` shape.
 */
export interface TextInputProps {
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Fired with the new text on every edit. */
  onChangeText?: (text: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

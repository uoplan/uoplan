import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";

import { SF_SYMBOL_FOR_ICON } from "./Icon.types";
import type { IconProps } from "./Icon.types";

/**
 * Native (SF Symbols via `expo-symbols`) implementation of the Icon contract.
 * Renders crisp vector glyphs (no emoji, no bitmaps) using the same symbol set
 * the native shell's tab bar and list rows use.
 */
export function Icon({ name, size = 20, color = "#2a2826", label, testID }: IconProps) {
  return (
    <SymbolView
      name={SF_SYMBOL_FOR_ICON[name] as SFSymbol}
      size={size}
      tintColor={color}
      type="monochrome"
      accessibilityLabel={label}
      testID={testID}
    />
  );
}

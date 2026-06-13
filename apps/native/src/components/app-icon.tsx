import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";

import { Surface } from "@/constants/theme";

export type IconName = SFSymbol;

interface AppIconProps {
  /** SF Symbol name (iOS), e.g. "magnifyingglass". Mirrors the native tab icons. */
  name: IconName;
  /** Point size. Defaults to 22. */
  size?: number;
  /** Tint colour. Defaults to the primary label colour. */
  color?: string;
  /** Symbol weight. Defaults to "regular". */
  weight?: SymbolWeight;
}

/**
 * Crisp, native icon backed by SF Symbols via `expo-symbols` — the same symbol
 * set the bottom tab bar uses. Renders vector glyphs (no emoji, no bitmap), and
 * needs no extra native module since `expo-symbols` is already linked. On
 * platforms without SF Symbols (Android/web) the symbol simply renders nothing
 * until a fallback set is added; iOS is the current target.
 */
export function AppIcon({
  name,
  size = 22,
  color = Surface.label,
  weight = "regular",
}: AppIconProps) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} type="monochrome" />;
}

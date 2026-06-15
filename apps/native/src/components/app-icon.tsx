import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";
import { Platform } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Surface } from "@/constants/theme";

import { ICON_PATHS } from "./icon-paths.generated";

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

/** Outline stroke width per SF Symbol weight (Tabler's default is 2). */
const STROKE_FOR_WEIGHT: Partial<Record<SymbolWeight, number>> = {
  ultraLight: 1.25,
  thin: 1.5,
  light: 1.75,
  regular: 2,
  medium: 2,
  semibold: 2.25,
  bold: 2.5,
  heavy: 2.75,
  black: 3,
};

/**
 * Crisp, native icon backed by SF Symbols via `expo-symbols` on iOS — the same
 * symbol set the bottom tab bar uses. SF Symbols don't exist on Android/web, so
 * there we draw the equivalent Tabler glyph from baked path data
 * (`icon-paths.generated.ts`) with `react-native-svg`. Unmapped names fall back
 * to a visible circle so an icon is never silently invisible.
 */
export function AppIcon({
  name,
  size = 22,
  color = Surface.label,
  weight = "regular",
}: AppIconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView name={name} size={size} tintColor={color} weight={weight} type="monochrome" />
    );
  }

  const entry = ICON_PATHS[name] ?? ICON_PATHS.circle;
  if (entry.filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        {entry.paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </Svg>
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE_FOR_WEIGHT[weight] ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {entry.paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

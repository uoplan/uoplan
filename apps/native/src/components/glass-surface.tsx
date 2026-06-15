import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { Surface } from "@/constants/theme";

/** Resolved once: iOS 26+ Liquid Glass capability. Older OSes fall back to a card. */
const GLASS_AVAILABLE = Platform.OS === "ios" && isLiquidGlassAvailable();

interface GlassSurfaceProps {
  /** Layout-only style (size, radius, position, alignment) — NOT a background. */
  style?: StyleProp<ViewStyle>;
  /** Whether the glass should morph on touch (use for tappable surfaces). */
  interactive?: boolean;
  children?: ReactNode;
}

/**
 * Floating-overlay chrome that renders Apple's Liquid Glass material on iOS 26+
 * (the same material the native tab bar uses), so floating buttons match the nav.
 * `colorScheme="auto"` lets the glass follow the system light/dark appearance.
 * On platforms without Liquid Glass it degrades to the app's solid card surface
 * with a hairline border + soft shadow, preserving the previous look.
 *
 * Callers pass only layout in `style` (size / borderRadius / position); the
 * background is owned here so the glass isn't hidden behind an opaque fill.
 */
export function GlassSurface({ style, interactive = false, children }: GlassSurfaceProps) {
  if (GLASS_AVAILABLE) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="auto"
        isInteractive={interactive}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.solid, style]}>{children}</View>;
}

/** Whether Liquid Glass is active (exported so callers can drop redundant fills). */
export const glassAvailable = GLASS_AVAILABLE;

const styles = StyleSheet.create({
  solid: {
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});

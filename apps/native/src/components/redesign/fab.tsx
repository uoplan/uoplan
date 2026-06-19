import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { GlassSurface, glassAvailable } from "@/components/glass-surface";
import { Spacing, Surface } from "@/constants/theme";

interface FabProps {
  icon: IconName;
  onPress: () => void;
  /** Required: the FAB shows no visible text, so it needs an a11y label. */
  accessibilityLabel: string;
  /** Optional count badge (e.g. basket items). */
  badge?: number;
  /**
   * Accent (filled) styling for a primary action like "Add to basket". The
   * default is a neutral Liquid-Glass surface that matches the floating tab bar.
   */
  accent?: boolean;
}

/**
 * Floating action button — a 56pt circular control. The default renders on
 * Apple's Liquid Glass (iOS 26+) so it matches the native tab bar, degrading to
 * a solid card surface elsewhere; the `accent` variant is a filled accent circle
 * for a primary call to action (e.g. "Add to basket"), making it stand out.
 *
 * The FAB is **presentational and not positioned** — wrap it in {@link FabStack}
 * (or another absolutely-positioned container) to anchor it on screen.
 */
export function Fab({ icon, onPress, accessibilityLabel, badge, accent = false }: FabProps) {
  const showBadge = badge != null && badge > 0;
  const glyphColor = accent ? Surface.onAccent : Surface.label;
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.pressable}
      hitSlop={8}
    >
      <AppIcon name={icon} size={24} color={glyphColor} />
    </Pressable>
  );
  return (
    <View style={styles.fab}>
      {accent ? (
        <View style={[styles.surface, styles.accentSurface]}>{button}</View>
      ) : (
        <GlassSurface interactive style={styles.surface}>
          {button}
        </GlassSurface>
      )}
      {showBadge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text size="xs" weight="bold" color={Surface.onAccent}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FabStackProps {
  children: ReactNode;
}

/**
 * Bottom-right anchor for one or more {@link Fab}s. It clears the bottom tab bar
 * so the FAB is never hidden behind it:
 *
 * - On iOS 26+ the tab bar is a floating capsule centred at the bottom, leaving
 *   the bottom-right corner free, so the stack tucks into that corner.
 * - On Android (and pre-26 iOS) the tab bar spans the full width, so the stack
 *   floats above it.
 *
 * Children stack vertically, so the first child sits highest and the last child
 * rests nearest the screen's bottom edge (the primary, thumb-reachable slot).
 */
export function FabStack({ children }: FabStackProps) {
  const insets = useSafeAreaInsets();
  // Full-width bars need the FAB lifted above them; the floating iOS 26 capsule
  // leaves the corner clear, so no extra lift is needed there.
  const barClearance = glassAvailable
    ? 0
    : Platform.OS === "android"
      ? ANDROID_TAB_BAR_HEIGHT
      : IOS_LEGACY_TAB_BAR_HEIGHT;
  const bottom = insets.bottom + barClearance + Spacing.three;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { bottom }]}>
      {children}
    </View>
  );
}

const SIZE = 56;
/** Full-width tab-bar heights (above the safe-area inset) the FAB must clear. */
const ANDROID_TAB_BAR_HEIGHT = 56;
const IOS_LEGACY_TAB_BAR_HEIGHT = 49;

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    right: Spacing.three,
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  fab: {
    width: SIZE,
    height: SIZE,
  },
  surface: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  accentSurface: {
    backgroundColor: Surface.accent,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  pressable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accent,
    borderWidth: 1.5,
    borderColor: Surface.page,
  },
});

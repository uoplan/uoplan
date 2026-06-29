import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { GlassSurface } from "@/components/glass-surface";
import { Spacing, Surface } from "@/constants/theme";

interface FabProps {
  icon: IconName;
  onPress: () => void;
  /** Required: the FAB shows no visible text, so it needs an a11y label. */
  accessibilityLabel: string;
  /** Optional count badge (e.g. basket items). */
  badge?: number;
  /**
   * Show a warning "!" badge instead of the count — used when the basket has a
   * problem (e.g. a course with unmet prerequisites or not offered this term).
   * Takes precedence over {@link badge}.
   */
  alert?: boolean;
  /**
   * Accent (filled) styling for a primary action like "Add to basket". The
   * default is a neutral Liquid-Glass surface that matches the floating tab bar.
   */
  accent?: boolean;
  /**
   * Dim the FAB and ignore presses — used when the action isn't available, e.g.
   * the viewed course's prerequisites aren't met (so it can't be added).
   */
  disabled?: boolean;
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
export function Fab({
  icon,
  onPress,
  accessibilityLabel,
  badge,
  alert = false,
  accent = false,
  disabled = false,
}: FabProps) {
  const showBadge = alert || (badge != null && badge > 0);
  const glyphColor = accent ? Surface.onAccent : Surface.label;
  const button = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={styles.pressable}
      hitSlop={8}
    >
      <AppIcon name={icon} size={24} color={glyphColor} />
    </Pressable>
  );
  return (
    <View style={[styles.fab, disabled && styles.fabDisabled]}>
      {accent ? (
        <View style={[styles.surface, styles.accentSurface]}>{button}</View>
      ) : (
        <GlassSurface interactive style={styles.surface}>
          {button}
        </GlassSurface>
      )}
      {showBadge ? (
        <View style={[styles.badge, alert && styles.badgeAlert]} pointerEvents="none">
          <Text size="xs" weight="bold" color={Surface.onAccent}>
            {alert ? "!" : badge != null && badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FabStackProps {
  children: ReactNode;
  /**
   * Extra px to lift the stack above its baseline — used to clear the always-on
   * global basket cart that occupies the bottom slot, so a screen-specific FAB
   * (e.g. "add to basket") floats ABOVE it instead of overlapping.
   */
  bottomOffset?: number;
}

/**
 * Bottom-right anchor for one or more {@link Fab}s. It clears the bottom tab bar
 * so the FAB floats just above it, never hidden behind it. The exact offset is
 * platform-specific because Android's custom bar sits in normal flow below the
 * content while iOS's `UITabBar` overlays it — see
 * {@link useFloatingControlsBottom} for the per-platform reasoning.
 *
 * Children stack vertically, so the first child sits highest and the last child
 * rests nearest the screen's bottom edge (the primary, thumb-reachable slot).
 */
export function FabStack({ children, bottomOffset = 0 }: FabStackProps) {
  const bottom = useFloatingControlsBottom() + bottomOffset;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { bottom }]}>
      {children}
    </View>
  );
}

/**
 * The bottom offset (px) for floating controls that must rest just above the tab
 * bar — shared by {@link FabStack} and the schedule screen's `BottomControlBar`
 * so the cart FAB and the pager/options bar sit on the SAME baseline on each
 * platform (otherwise they float at different heights).
 *
 * - Android (`app-tabs-android.tsx`) is a flat custom bar laid out as a normal
 *   flow sibling BELOW the screen content (`TabSlot` is `flex: 1`, the bar
 *   sits under it). This screen's content area therefore already ENDS at the
 *   bar's top edge — `bottom: 0` is that edge — and the bar absorbs the bottom
 *   safe-area inset via its own padding. So the controls only need a small gap.
 * - iOS uses a real `UITabBar` (a floating Liquid-Glass capsule on iOS 26+, a
 *   full-width bar on older iOS). In BOTH cases the tab screen runs full-bleed
 *   under the bar and UIKit already folds the bar into that screen's bottom
 *   safe-area inset, so `insets.bottom` lands at the bar's top edge — the
 *   controls just add a small gap on top. (Adding the bar height again here
 *   double-counts and floats the controls far too high on legacy iOS.)
 */
export function useFloatingControlsBottom(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "android" ? Spacing.three : insets.bottom + Spacing.three;
}

const SIZE = 56;

/**
 * Vertical distance one FAB occupies in a {@link FabStack} (button + the stack's
 * gap). Pass as `bottomOffset` to lift a screen-specific FAB above the global
 * basket cart that always sits in the bottom slot.
 */
export const FAB_SLOT = SIZE + Spacing.three;

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    right: Spacing.three,
    alignItems: "flex-end",
    gap: Spacing.three,
  },
  fab: {
    width: SIZE,
    height: SIZE,
  },
  fabDisabled: {
    opacity: 0.4,
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
    // On Android, sibling stacking follows `elevation`, not JSX paint order, so
    // the glass/card surface (elevation 4) would otherwise cover the badge. Lift
    // the badge above it; `zIndex` keeps the same order on iOS/web.
    zIndex: 1,
    elevation: 8,
  },
  badgeAlert: {
    backgroundColor: Surface.warning,
  },
});

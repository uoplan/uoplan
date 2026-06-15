import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { GlassSurface } from "@/components/glass-surface";
import { Surface } from "@/constants/theme";

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  /** Optional leading SF Symbol. */
  icon?: IconName;
  /** Muted/confirmed state (e.g. already in basket) vs. accent call-to-action. */
  active?: boolean;
  /** Layout/position style merged onto the glass surface. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A floating Liquid-Glass pill button (iOS 26+) — the same material as the tab
 * bar and cart FAB — for primary actions like "Add to basket". Degrades to a
 * solid card surface where Liquid Glass is unavailable. The label/icon use the
 * accent colour as a call-to-action, switching to a muted tone when `active`.
 */
export function GlassButton({ label, onPress, icon, active = false, style }: GlassButtonProps) {
  const tint = active ? Surface.dimmed : Surface.accent;
  return (
    <GlassSurface interactive style={[styles.button, style]}>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.pressable} hitSlop={8}>
        {icon ? <AppIcon name={icon} size={18} color={tint} /> : null}
        <Text weight="bold" color={tint}>
          {label}
        </Text>
      </Pressable>
    </GlassSurface>
  );
}

interface GlassIconButtonProps {
  /** SF Symbol to render centred in the circle. */
  icon: IconName;
  onPress: () => void;
  /** Required for screen readers (the button has no visible label). */
  accessibilityLabel: string;
  /** Circle diameter (default 40). */
  size?: number;
  /** Optional count bubble (e.g. basket items) in the top-right corner. */
  badge?: number;
  /** Optional position/layout override merged onto the glass surface. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A circular Liquid-Glass icon button (iOS 26+) — the same material as the tab
 * bar, cart FAB and `GlassButton`. Used for chrome controls like the header back
 * arrow, cart and settings gear so floating buttons read as one consistent
 * material. Icon-only by design (no text); pass `accessibilityLabel` for screen
 * readers. An optional `badge` renders a small count bubble (e.g. basket items).
 */
export function GlassIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 40,
  badge,
  style,
}: GlassIconButtonProps) {
  const showBadge = badge != null && badge > 0;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <GlassSurface interactive style={{ width: size, height: size, borderRadius: size / 2 }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={styles.pressable}
          hitSlop={8}
        >
          <AppIcon name={icon} size={Math.round(size * 0.45)} color={Surface.label} />
        </Pressable>
      </GlassSurface>
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

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
  },
  pressable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accent,
    borderWidth: 2,
    borderColor: Surface.page,
  },
});

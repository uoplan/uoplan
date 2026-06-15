import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { GlassSurface } from "@/components/glass-surface";
import { Surface } from "@/constants/theme";

interface FabProps {
  icon?: IconName;
  onPress: () => void;
  /** Optional count badge (e.g. basket items). */
  badge?: number;
  /** Distance from the bottom — raise it above a bottom control bar. */
  bottom?: number;
}

/**
 * Floating action button (bottom-right), e.g. the explore/trends basket. Rendered
 * on Liquid Glass (iOS 26+) so it matches the native tab bar; degrades to a solid
 * card surface elsewhere.
 */
export function Fab({ icon = "cart", onPress, badge, bottom = 24 }: FabProps) {
  const showBadge = badge != null && badge > 0;
  return (
    <GlassSurface interactive style={[styles.fab, { bottom }]}>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.pressable} hitSlop={8}>
        <AppIcon name={icon} size={22} color={Surface.label} />
      </Pressable>
      {showBadge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text size="xs" weight="bold" color={Surface.onAccent}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accent,
  },
});

import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassIconButton } from "@/components/redesign/glass-button";
import { Spacing } from "@/constants/theme";

/**
 * The app's persistent settings gear, mounted ONCE per tab stack (in each tab's
 * `_layout`) as a sibling of the navigator — the top-right counterpart to
 * {@link GlobalBasketCart}. Because it lives above the per-screen stack it stays
 * a single, consistent size on every screen and never animates with push/pop
 * transitions (it doesn't slide away when the user swipes back a page). Its top
 * offset matches `RedesignScreen`'s sticky back arrow so the two align.
 */
export function GlobalSettingsButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.one }]}>
      <GlassIconButton
        icon="gearshape"
        accessibilityLabel="Settings"
        onPress={() => router.push("/more")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: Spacing.three,
  },
});

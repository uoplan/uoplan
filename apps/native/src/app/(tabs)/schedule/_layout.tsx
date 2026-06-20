import { Stack } from "expo-router";
import { View } from "react-native";

import { GlobalBasketCart } from "@/components/global-basket-cart";
import { GlobalSettingsButton } from "@/components/global-settings-button";
import { Surface } from "@/constants/theme";

/**
 * Nested stack for the Schedule tab so the basket pushes over the full-bleed
 * calendar (each with its own in-screen header) while the bottom tab bar stays
 * visible. Personalize now lives in its own bottom-tab.
 */
export default function ScheduleLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Surface.page },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="basket" />
      </Stack>
      <GlobalBasketCart />
      <GlobalSettingsButton />
    </View>
  );
}

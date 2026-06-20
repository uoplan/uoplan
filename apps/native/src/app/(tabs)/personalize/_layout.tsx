import { Stack } from "expo-router";
import { View } from "react-native";

import { GlobalBasketCart } from "@/components/global-basket-cart";
import { GlobalSettingsButton } from "@/components/global-settings-button";
import { Surface } from "@/constants/theme";

/**
 * Stack for the Personalize tab. The wizard is the tab root (no back chrome);
 * Generate switches back to the Schedule tab, where the native engine builds
 * timetables from the persisted basket.
 */
export default function PersonalizeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Surface.page },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <GlobalBasketCart />
      <GlobalSettingsButton />
    </View>
  );
}

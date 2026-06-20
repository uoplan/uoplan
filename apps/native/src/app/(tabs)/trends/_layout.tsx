import { Stack } from "expo-router";
import { View } from "react-native";

import { GlobalBasketCart } from "@/components/global-basket-cart";
import { GlobalSettingsButton } from "@/components/global-settings-button";
import { Surface } from "@/constants/theme";

/**
 * Nested stack for the Trends tab so the dashboard's detail screens (course
 * signals, disciplines, course feedback) push with a native header while the
 * bottom tab bar stays visible — mirroring the web Trends hub → sub-page flow.
 */
export default function TrendsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Surface.page },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Trends" }} />
        <Stack.Screen name="courses" options={{ title: "Choosing courses" }} />
        <Stack.Screen name="disciplines" options={{ title: "Disciplines" }} />
        <Stack.Screen name="feedback" options={{ title: "Course feedback" }} />
        <Stack.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      </Stack>
      <GlobalBasketCart />
      <GlobalSettingsButton />
    </View>
  );
}

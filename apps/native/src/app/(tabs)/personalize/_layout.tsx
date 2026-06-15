import { Stack } from "expo-router";

import { Surface } from "@/constants/theme";

/**
 * Stack for the Personalize tab. The wizard is the tab root (no back chrome);
 * Generate switches back to the Schedule tab, where the native engine builds
 * timetables from the persisted basket.
 */
export default function PersonalizeLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Surface.page },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}

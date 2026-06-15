import { Stack } from "expo-router";

import { Surface } from "@/constants/theme";

/**
 * Nested stack for the Schedule tab so the basket pushes over the full-bleed
 * calendar (each with its own in-screen header) while the bottom tab bar stays
 * visible. Personalize now lives in its own bottom-tab.
 */
export default function ScheduleLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Surface.page },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="basket" />
    </Stack>
  );
}

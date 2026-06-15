import { Stack } from "expo-router";

import { Surface } from "@/constants/theme";

/**
 * Nested stack for the More settings flow. The tab trigger is intentionally
 * absent; `/more` stays pushable from in-content settings buttons, and every
 * screen renders its own liquid-glass `ScreenHeader` controls.
 */
export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Surface.page },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "More" }} />
      <Stack.Screen name="language" options={{ title: "Language" }} />
      <Stack.Screen name="changelog" options={{ title: "Changelog" }} />
      <Stack.Screen name="gallery" options={{ title: "Component gallery" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
    </Stack>
  );
}

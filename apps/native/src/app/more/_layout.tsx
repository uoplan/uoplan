import { Stack } from "expo-router";

import { Surface } from "@/constants/theme";

/**
 * Nested stack for the More tab so detail screens (settings, developer tools)
 * push with a native navigation header while the bottom tab bar stays visible.
 */
export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Surface.card },
        headerTintColor: Surface.accent,
        headerTitleStyle: { color: Surface.label },
        contentStyle: { backgroundColor: Surface.page },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "More" }} />
      <Stack.Screen name="graph" options={{ title: "Professor network" }} />
      <Stack.Screen name="changelog" options={{ title: "Changelog" }} />
      <Stack.Screen name="gallery" options={{ title: "Component gallery" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
    </Stack>
  );
}

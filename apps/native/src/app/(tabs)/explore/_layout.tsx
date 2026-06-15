import { Stack } from "expo-router";

import { Surface } from "@/constants/theme";

/**
 * Nested stack for the Explore tab so course / professor / discipline / faculty
 * detail screens push over the search index (each with its own in-screen
 * header) while the bottom tab bar stays visible — mirroring the web explore
 * search ↔ detail flow.
 */
export default function ExploreLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Surface.page },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="course/[code]/index" />
      <Stack.Screen name="course/[code]/feedback" />
      <Stack.Screen name="course/[code]/schedule" />
      <Stack.Screen name="professor/[slug]/index" />
      <Stack.Screen name="professor/[slug]/feedback" />
      <Stack.Screen name="discipline/[code]" />
      <Stack.Screen name="faculty/[id]" />
      <Stack.Screen name="program/[...slug]" />
    </Stack>
  );
}

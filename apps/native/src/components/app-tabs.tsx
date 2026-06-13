import { NativeTabs } from "expo-router/unstable-native-tabs";

import { Surface } from "@/constants/theme";

/**
 * The app's bottom tab bar — a real iOS `UITabBar` / Android tab bar via Expo
 * Router's native tabs. Five product destinations mirroring the web app's
 * primary sections, each with an SF Symbol icon (iOS) and a Material drawable
 * (Android). Pinned to the warm-paper palette so it matches the `@uoplan/ui`
 * light surfaces the screens render on.
 */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Surface.card}
      indicatorColor={Surface.subtle}
      iconColor={{ default: Surface.dimmed, selected: Surface.accent }}
      labelStyle={{ selected: { color: Surface.accent } }}
      tintColor={Surface.accent}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          drawable="ic_menu_home"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" drawable="ic_menu_search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule">
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" drawable="ic_menu_my_calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trends">
        <NativeTabs.Trigger.Label>Trends</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          drawable="ic_menu_sort_by_size"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          drawable="ic_menu_more"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

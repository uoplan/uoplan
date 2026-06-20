import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import AndroidTabs from "@/components/app-tabs-android";
import { Surface } from "@/constants/theme";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { isPersonalizationIncomplete } from "@/lib/personalization";

/**
 * The app's bottom tab bar. iOS uses a real `UITabBar` via Expo Router's native
 * tabs. Android uses a flat custom bar (`AndroidTabs`) instead of Expo's
 * Material `NativeTabs`, which forces a blue ripple, a selected-item lift, and
 * generic framework drawables that can't be restyled away.
 *
 * The platform split lives here as a runtime `Platform.OS` branch rather than an
 * `app-tabs.android.tsx` file because the only consumer reaches this module
 * through the `@/components/app-tabs` tsconfig-path alias, and Expo-metro's
 * alias resolver does not apply platform extensions to aliased specifiers.
 */
export default function AppTabs() {
  if (Platform.OS === "android") {
    return <AndroidTabs />;
  }
  return <IosTabs />;
}

/**
 * iOS bottom tab bar — four primary product destinations on a real `UITabBar`,
 * each with an SF Symbol icon. The Personalize tab shows a small indicator badge
 * while the user hasn't provided any personalization data (no program, start
 * year, or completed courses), nudging them to set up requirement-aware
 * schedules.
 */
function IosTabs() {
  const { personalization } = useScheduleOptions();
  const completed = useCompletedCourses();
  const personalizeIncomplete = isPersonalizationIncomplete({
    programUrl: personalization.programUrl,
    startYear: personalization.startYear,
    completedCourseCount: completed.codes.length,
  });

  return (
    <NativeTabs
      sidebarAdaptable
      backgroundColor={Surface.card}
      indicatorColor={Surface.subtle}
      iconColor={{ default: Surface.dimmed, selected: Surface.accent }}
      labelStyle={{ selected: { color: Surface.accent } }}
      tintColor={Surface.accent}
      badgeBackgroundColor={Surface.accent}
    >
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label hidden>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" drawable="ic_menu_search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule">
        <NativeTabs.Trigger.Label hidden>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" drawable="ic_menu_my_calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="personalize">
        <NativeTabs.Trigger.Label hidden>Personalize</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          drawable="ic_menu_preferences"
        />
        <NativeTabs.Trigger.Badge hidden={!personalizeIncomplete} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trends">
        <NativeTabs.Trigger.Label hidden>Trends</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          drawable="ic_menu_sort_by_size"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

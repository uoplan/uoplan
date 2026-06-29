import { type Href } from "expo-router";
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import { forwardRef, type Ref } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Surface } from "@/constants/theme";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { isPersonalizationIncomplete } from "@/lib/personalization";

interface TabDef {
  name: string;
  href: Href;
  icon: IconName;
  /** Accessibility label (the visible label is hidden, mirroring iOS). */
  label: string;
}

const TABS: readonly TabDef[] = [
  { name: "explore", href: "/explore", icon: "magnifyingglass", label: "Explore" },
  { name: "schedule", href: "/schedule", icon: "calendar", label: "Schedule" },
  { name: "personalize", href: "/personalize", icon: "person.crop.circle", label: "Personalize" },
  { name: "trends", href: "/trends", icon: "chart.bar", label: "Trends" },
];

interface TabButtonProps extends TabTriggerSlotProps {
  icon: IconName;
  label: string;
  showBadge?: boolean;
}

/**
 * A single tab cell — an `AppIcon` whose colour signals selection (accent when
 * focused, dimmed otherwise). No Material ripple and no selected-state shift:
 * the only feedback is a brief opacity dip on press. Forwards the slot props
 * (`onPress`, `isFocused`, ref) that `TabTrigger asChild` injects.
 */
const TabButton = forwardRef(function TabButton(
  { icon, label, isFocused, showBadge, style: _style, ...props }: TabButtonProps,
  ref: Ref<View>,
) {
  const color = isFocused ? Surface.accent : Surface.dimmed;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      android_ripple={null}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      {...props}
    >
      <View>
        <AppIcon name={icon} size={26} color={color} weight={isFocused ? "semibold" : "regular"} />
        {showBadge ? <View style={styles.badge} /> : null}
      </View>
    </Pressable>
  );
});

/**
 * Android bottom tab bar. Replaces Expo's Material `NativeTabs` (which forces a
 * blue ripple, a selected-item lift, and generic framework drawables) with a
 * flat custom bar that uses the same `AppIcon` glyphs as the rest of the app.
 * iOS keeps the real `UITabBar` (see `app-tabs.tsx`, which delegates here on
 * Android via a `Platform.OS` branch).
 */
export default function AndroidTabs() {
  const insets = useSafeAreaInsets();
  const { personalization } = useScheduleOptions();
  const completed = useCompletedCourses();
  const personalizeIncomplete = isPersonalizationIncomplete({
    programUrl: personalization.programUrl,
    startYear: personalization.startYear,
    completedCourseCount: completed.codes.length,
  });

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton
              icon={tab.icon}
              label={tab.label}
              showBadge={tab.name === "personalize" && personalizeIncomplete}
            />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    backgroundColor: Surface.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  pressed: { opacity: 0.55 },
  badge: {
    position: "absolute",
    bottom: -1,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: Surface.accent,
    borderWidth: 1.5,
    borderColor: Surface.card,
  },
});

import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GradeVizBar } from "@/components/grade-viz-bar";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { PillButton } from "@/components/redesign/pill-button";
import { Spacing, Surface } from "@/constants/theme";
import { useBasket } from "@/data/basket-provider";
import { useAppData } from "@/data/data-provider";

/**
 * The basket — the courses the user has gathered to schedule (the native
 * analogue of the web sitewide basket / generation requirements). Lists each
 * desired course with its grade-viz bar and a remove control, and hands off to
 * the schedule generator.
 */
export default function BasketScreen() {
  const router = useRouter();
  const { codes, remove, clear, count } = useBasket();
  const { index } = useAppData();

  const items = useMemo(() => {
    const byCode = new Map(index.courses.map((c) => [c.code, c] as const));
    return codes.map((code) => ({ code, course: byCode.get(code) ?? null }));
  }, [codes, index]);

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Back" onBack={() => router.back()}>
      <ScreenHeader
        title="Basket"
        subtitle={count > 0 ? `${count} course${count === 1 ? "" : "s"} to schedule` : undefined}
      />

      {count === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="cart" size={28} color={Surface.dimmed} />
          <Text dimmed align="center">
            Your basket is empty. Add courses from the explorer to build a schedule.
          </Text>
          <Pressable
            onPress={() => router.push("/explore")}
            accessibilityRole="button"
            style={styles.browse}
          >
            <Text size="sm" weight="bold" color={Surface.accent}>
              Browse courses
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <SectionCard title="Courses" subtitle="Tap × to remove">
            {items.map(({ code, course }) => (
              <View key={code} style={styles.row}>
                <View style={styles.head}>
                  <View style={styles.text}>
                    <Text size="sm" weight="bold" color={Surface.accent}>
                      {code}
                    </Text>
                    {course ? (
                      <Text size="sm" dimmed numberOfLines={1}>
                        {course.title}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => remove(code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${code}`}
                    hitSlop={10}
                  >
                    <AppIcon name="xmark" size={14} color={Surface.dimmed} />
                  </Pressable>
                </View>
                {course?.gradeViz ? <GradeVizBar gradeViz={course.gradeViz} /> : null}
              </View>
            ))}
          </SectionCard>

          <PillButton
            label="Generate schedule"
            variant="primary"
            onPress={() => router.push("/schedule")}
          />

          <PillButton label="Clear basket" variant="destructive" onPress={clear} />
        </>
      )}
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  browse: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: Surface.accentSoft,
  },
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

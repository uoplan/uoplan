import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { BasketFab } from "@/components/basket-fab";
import { type CollapsibleEntry, CollapsibleList } from "@/components/explore/collapsible-list";
import { ResponsiveColumns } from "@/components/layout";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { parseProgramSlugParam, programDetail } from "@/data/explore-detail";

function slugKey(slug: string | string[] | undefined): string {
  return Array.isArray(slug) ? slug.join("/") : (slug ?? "");
}

/** Program detail, backed by the native catalogue requirement tree. */
export default function ProgramDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const { bundle, index } = useAppData();
  const slug = slugKey(params.slug);
  const detail = useMemo(() => programDetail(bundle, index, params.slug), [bundle, index, slug]);
  const fallbackTitle = parseProgramSlugParam(params.slug) ?? "Program";

  if (!detail) {
    return (
      <RedesignScreen
        gap={Spacing.three}
        backLabel="Explore"
        onBack={() => router.back()}
        cart={<BasketFab />}
        onSettings={() => router.push("/more")}
      >
        <ScreenHeader title={fallbackTitle} />
        <Text dimmed>This program isn’t in the loaded catalogue.</Text>
      </RedesignScreen>
    );
  }

  const { coreCourses, program, requirementCount } = detail;
  const courseEntries: CollapsibleEntry[] = coreCourses.map((course) => ({
    key: course.code,
    code: course.code,
    title: course.title,
    meta: course.gpa != null ? `${course.gpa.toFixed(1)} avg` : undefined,
    gradeViz: course.gradeViz,
    body: (
      <View style={styles.coursePanel}>
        {course.gradeViz ? null : (
          <View style={styles.noData}>
            <Text size="sm" dimmed>
              No grade data yet.
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/explore/course/[code]",
              params: { code: course.code },
            })
          }
          style={styles.openCourse}
        >
          <View style={styles.openCourseText}>
            <AppIcon name="book" size={15} color={Surface.accent} />
            <Text size="sm" weight="bold" color={Surface.accent}>
              Open course
            </Text>
          </View>
          <AppIcon name="chevron.right" size={12} color={Surface.accent} />
        </Pressable>
      </View>
    ),
  }));

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel="Explore"
      onBack={() => router.back()}
      cart={<BasketFab />}
      onSettings={() => router.push("/more")}
    >
      <ScreenHeader
        title={program.title}
        subtitle={`${requirementCount.toLocaleString()} requirement rows`}
      />

      <ResponsiveColumns gap={Spacing.three}>
        {program.url ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(program.url)}
            style={({ pressed }) => [styles.officialLink, pressed && styles.officialLinkPressed]}
          >
            <AppIcon name="arrow.up.right" size={14} color={Surface.accent} />
            <Text size="sm" weight="bold" color={Surface.accent}>
              Official catalogue page
            </Text>
          </Pressable>
        ) : null}

        <SectionCard
          title="Required courses"
          subtitle={`${coreCourses.length.toLocaleString()} concrete course${
            coreCourses.length === 1 ? "" : "s"
          } found in the requirement tree`}
        >
          {coreCourses.length > 0 ? (
            <CollapsibleList entries={courseEntries} />
          ) : (
            <Text size="sm" dimmed>
              No concrete required course codes are present in the native requirement tree for this
              program yet.
            </Text>
          )}
        </SectionCard>
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  officialLink: {
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  officialLinkPressed: {
    opacity: 0.72,
  },
  coursePanel: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  noData: {
    paddingVertical: Spacing.two,
  },
  openCourse: {
    alignItems: "center",
    borderTopColor: Surface.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },
  openCourseText: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
});

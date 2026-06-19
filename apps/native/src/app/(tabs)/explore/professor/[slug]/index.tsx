import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { type CollapsibleEntry, CollapsibleList } from "@/components/explore/collapsible-list";
import { FeedbackSummaryCard } from "@/components/explore/feedback-summary-card";
import { SectionOfferingsList } from "@/components/explore/section-offerings-list";
import { GradeHistogram } from "@/components/grade-histogram";
import { ResponsiveColumns } from "@/components/layout";
import { BasketFab } from "@/components/basket-fab";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData, useFeedback } from "@/data/data-provider";
import { professorDetail } from "@/data/explore-detail";
import { feedbackHeadline, feedbackViewsForProfessor } from "@/data/feedback-data";

/** Professor detail — grade distribution + courses they have taught. */
export default function ProfessorDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug ?? "");
  const { bundle, index } = useAppData();
  const feedback = useFeedback();
  const detail = useMemo(() => professorDetail(bundle, index, slug), [bundle, index, slug]);
  const feedbackViews = useMemo(
    () => (detail ? feedbackViewsForProfessor(feedback, detail.professor.name) : []),
    [feedback, detail],
  );
  const satisfaction = useMemo(() => feedbackHeadline(feedbackViews).satisfaction, [feedbackViews]);

  if (!detail) {
    return (
      <RedesignScreen
        gap={Spacing.three}
        backLabel="Explore"
        onBack={() => router.back()}
        cart={<BasketFab />}
        onSettings={() => router.push("/more")}
      >
        <ScreenHeader title="Professor" />
        <Text dimmed>This professor isn’t in the loaded registry.</Text>
      </RedesignScreen>
    );
  }

  const { professor, courses } = detail;
  const courseEntries: CollapsibleEntry[] = courses.map((course) => ({
    key: course.code,
    code: course.code,
    title: course.title,
    subtitleNode: (
      <View style={styles.courseStats}>
        {course.gpa != null ? (
          <Text size="xs" color={Surface.dimmed}>
            {course.gpa.toFixed(2)} avg
          </Text>
        ) : null}
        <Text size="xs" color={Surface.dimmed}>
          {course.graded.toLocaleString()} graded
        </Text>
      </View>
    ),
    headerExtra: course.gradeViz ? (
      <View style={styles.courseHistogram}>
        <GradeHistogram gradeViz={course.gradeViz} maxBarPx={72} showSummary />
      </View>
    ) : null,
    body: (
      <View style={styles.coursePanel}>
        <SectionOfferingsList offerings={course.offerings ?? []} />
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/explore/course/[code]",
              params: { code: course.code },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`View ${course.code}`}
          style={styles.viewCourse}
        >
          <Text size="sm" weight="bold" color={Surface.accent}>
            View course
          </Text>
          <AppIcon name="arrow.up.right" size={13} color={Surface.accent} />
        </Pressable>
      </View>
    ),
  }));
  const stats = [
    satisfaction != null ? `${satisfaction.toFixed(1)} / 5 rating` : null,
    professor.rating != null ? `★ ${professor.rating.toFixed(1)}` : null,
    professor.gpa != null ? `${professor.gpa.toFixed(1)} avg` : null,
    professor.graded > 0 ? `${professor.graded.toLocaleString()} grades` : null,
  ].filter((s): s is string => s != null);

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel="Explore"
      onBack={() => router.back()}
      cart={<BasketFab />}
      onSettings={() => router.push("/more")}
    >
      <ScreenHeader
        title={professor.name}
        subtitle={professor.numRatings ? `${professor.numRatings} ratings` : undefined}
      />

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat} style={styles.pill}>
            <Text size="sm" color={Surface.label}>
              {stat}
            </Text>
          </View>
        ))}
      </View>

      <ResponsiveColumns gap={Spacing.three}>
        {feedbackViews.length > 0 ? (
          <FeedbackSummaryCard
            views={feedbackViews}
            onPress={() =>
              router.push({
                pathname: "/explore/professor/[slug]/feedback",
                params: { slug },
              })
            }
          />
        ) : null}

        {professor.gradeViz ? (
          <SectionCard title="Grade distribution">
            <GradeHistogram gradeViz={professor.gradeViz} showSummary showStudentCount />
          </SectionCard>
        ) : null}

        {courses.length > 0 ? (
          <View style={styles.coursesSection}>
            <Text size="sm" weight="bold" color={Surface.label}>
              Courses taught
            </Text>
            <CollapsibleList entries={courseEntries} />
          </View>
        ) : null}
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  pill: {
    backgroundColor: Surface.subtle,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  coursePanel: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  courseStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: 4,
  },
  courseHistogram: {
    marginTop: Spacing.two,
  },
  coursesSection: {
    gap: Spacing.two,
  },
  viewCourse: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
});

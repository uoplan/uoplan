import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { MAX_COMPARE_ITEMS, compareIdsForKind, type CompareRef } from "@uoplan/core";
import { buildPrereqGraph, normalizeCourseCode } from "@uoplan/core";
import { normalizeProfessorName } from "@uoplan/core/professorRatings";

import { AppIcon } from "@/components/app-icon";
import { type CollapsibleEntry, CollapsibleList } from "@/components/explore/collapsible-list";
import { CourseDescriptionSection } from "@/components/explore/course-description-section";
import { CoursePrereqGraph } from "@/components/explore/course-prereq-graph";
import { FeedbackSummaryCard } from "@/components/explore/feedback-summary-card";
import { SectionOfferingsList } from "@/components/explore/section-offerings-list";
import { GradeHistogram } from "@/components/grade-histogram";
import { ResponsiveColumns } from "@/components/layout";
import { RatingBadgeRow } from "@/components/rating-badge";
import { Fab, RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useBasket } from "@/data/basket-provider";
import { useCompare } from "@/data/compare-provider";
import { useAppData, useFeedback } from "@/data/data-provider";
import { courseDetail, courseScheduleTerms } from "@/data/explore-detail";
import { feedbackViewsForCourse, professorSentimentByName } from "@/data/feedback-data";
import { formatTermLabel } from "@/data/trends-data";
import { useTr } from "@/i18n";
import { useAnalytics } from "@/lib/analytics";
import { useCourseStatus, useNativePrereqGraphContext } from "@/lib/use-basket-status";

/** Course detail — grade distribution + professors who have taught it. */
export default function CourseDetailScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const tr = useTr();
  const params = useLocalSearchParams<{ code: string }>();
  const code = String(params.code ?? "");
  const { bundle, index, schedulesByTerm, aliasGroups } = useAppData();
  const feedback = useFeedback();
  const basket = useBasket();
  const compare = useCompare();
  const courseStatus = useCourseStatus({ code });
  const detail = useMemo(
    () => courseDetail(bundle, index, code, aliasGroups),
    [bundle, index, code, aliasGroups],
  );
  const feedbackViews = useMemo(() => feedbackViewsForCourse(feedback, code), [feedback, code]);
  const professorSentiment = useMemo(() => professorSentimentByName(feedback), [feedback]);
  const scheduleTerms = useMemo(
    () => courseScheduleTerms(schedulesByTerm, code),
    [schedulesByTerm, code],
  );
  const viewedCourseCode = detail?.course.code;
  const compareRef = useMemo<CompareRef>(
    () => ({ kind: "course", id: viewedCourseCode ?? code }),
    [viewedCourseCode, code],
  );
  const courseCompareIds = compareIdsForKind(compare.refs, "course");
  const compareCount = courseCompareIds.length;
  const inCompare = compare.has(compareRef);
  const compareLimitReached =
    !inCompare &&
    compare.refs.length > 0 &&
    compare.refs[0]?.kind === "course" &&
    compareCount >= MAX_COMPARE_ITEMS;

  useEffect(() => {
    if (viewedCourseCode) {
      analytics.capture("explore_course_viewed", { courseCode: viewedCourseCode });
    }
  }, [analytics, viewedCourseCode]);

  // Prerequisite graph: look up the full Course from the catalogue to get prereqRoot,
  // then build the graph with the shared prereq context.
  const { cache: prereqCache, plannerContext } = useNativePrereqGraphContext();
  const prereqGraph = useMemo(() => {
    if (!detail) return null;
    const catalogueCourse = bundle.catalogue.courses.find(
      (c) => normalizeCourseCode(c.code) === normalizeCourseCode(detail.course.code),
    );
    if (!catalogueCourse?.prerequisites) return null;
    return buildPrereqGraph({
      courseCode: normalizeCourseCode(detail.course.code),
      prereqRoot: catalogueCourse.prerequisites,
      plannerContext,
      cache: prereqCache,
      tr,
    });
  }, [detail, bundle.catalogue.courses, plannerContext, prereqCache, tr]);

  const navigateCourse = useCallback(
    (courseCode: string) => {
      router.push({ pathname: "/explore/course/[code]", params: { code: courseCode } });
    },
    [router],
  );

  const professorEntries = useMemo<CollapsibleEntry[]>(() => {
    if (!detail) return [];
    return detail.professors.map((prof) => {
      const slug = prof.slug;
      const satisfaction = professorSentiment.get(normalizeProfessorName(prof.name)) ?? null;
      return {
        key: slug ?? prof.name,
        code: prof.name,
        subtitleNode: (
          <View style={styles.professorStats}>
            <RatingBadgeRow satisfaction={satisfaction} rmp={prof.rating} />
            <Text size="xs" color={Surface.dimmed}>
              {prof.graded.toLocaleString()} graded
            </Text>
          </View>
        ),
        headerExtra: prof.gradeViz ? (
          <View style={styles.professorHistogram}>
            <GradeHistogram gradeViz={prof.gradeViz} maxBarPx={72} showSummary density="compact" />
          </View>
        ) : null,
        body: (
          <View style={styles.professorPanel}>
            <SectionOfferingsList offerings={prof.offerings ?? []} />
            {slug ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/explore/professor/[slug]",
                    params: { slug },
                  })
                }
                accessibilityRole="button"
                style={styles.professorLink}
              >
                <View style={styles.professorLinkText}>
                  <AppIcon name="person.crop.circle" size={16} color={Surface.accent} />
                  <Text size="sm" weight="bold" color={Surface.accent}>
                    View professor
                  </Text>
                </View>
                <AppIcon name="chevron.right" size={12} color={Surface.accent} />
              </Pressable>
            ) : null}
          </View>
        ),
      };
    });
  }, [detail, professorSentiment, router]);

  if (!detail) {
    return (
      <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
        <ScreenHeader title={code || "Course"} />
        <Text dimmed>This course isn’t in the loaded catalogue.</Text>
      </RedesignScreen>
    );
  }

  const { course, professors } = detail;
  const discipline = index.disciplines.find(
    (entry) => entry.code.toUpperCase() === course.discipline.toUpperCase(),
  );
  const faculty =
    discipline?.facultyId != null
      ? (index.faculties.find((entry) => entry.id === discipline.facultyId) ?? null)
      : null;
  const inBasket = basket.has(course.code);
  // Only block adding when the planner has academic grounding to judge against —
  // a program/year picked or other completed courses in the basket. With none of
  // that, `courseStatus.prerequisite` resolves to "unknown" (never "not_met"),
  // so we never disable and assume the user knows what they're doing.
  const prereqsUnmet = courseStatus.prerequisite === "not_met";
  const addDisabled = !inBasket && prereqsUnmet;
  const openCompare = () => {
    analytics.capture("compare_opened", { kind: "course", count: compareCount });
    router.push({
      pathname: "/explore/compare/[resource]",
      params: { resource: "course", ids: courseCompareIds.join(",") },
    });
  };

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel="Explore"
      onBack={() => router.back()}
      cart={
        <View style={styles.actionFabRow}>
          <Fab
            icon={inCompare ? "checkmark" : "plus"}
            accent={inCompare}
            disabled={compareLimitReached}
            onPress={() => compare.toggle(compareRef)}
            accessibilityLabel={
              compareLimitReached
                ? tr("compare.limitReached", { max: MAX_COMPARE_ITEMS })
                : tr(inCompare ? "compare.added" : "compare.add")
            }
          />
          <Fab
            icon={inBasket ? "checkmark" : "cart.badge.plus"}
            accent
            disabled={addDisabled}
            onPress={() => basket.toggle(course.code)}
            accessibilityLabel={
              addDisabled
                ? "Add to basket — prerequisites not met"
                : inBasket
                  ? "Remove from basket"
                  : "Add to basket"
            }
          />
        </View>
      }
    >
      <ScreenHeader title={course.code} subtitle={course.title} />

      <View style={styles.metadataBadges}>
        {faculty ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/explore/faculty/[id]",
                params: { id: faculty.id },
              })
            }
            style={({ pressed }) => [styles.metadataBadge, pressed && styles.metadataBadgePressed]}
          >
            <Text size="sm" weight="semibold" color={Surface.label} numberOfLines={1}>
              {faculty.name}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open in course catalogue"
          onPress={() =>
            void Linking.openURL(
              `https://catalogue.uottawa.ca/search/?P=${encodeURIComponent(course.code)}`,
            )
          }
          style={({ pressed }) => [
            styles.metadataBadge,
            styles.catalogueBadge,
            pressed && styles.metadataBadgePressed,
          ]}
        >
          <AppIcon name="arrow.up.right" size={13} color={Surface.accent} />
          <Text size="sm" weight="semibold" color={Surface.accent}>
            Open in catalogue
          </Text>
        </Pressable>
        {compareCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={openCompare}
            style={({ pressed }) => [
              styles.metadataBadge,
              styles.compareBadge,
              pressed && styles.metadataBadgePressed,
            ]}
          >
            <AppIcon name="square.grid.2x2.fill" size={13} color={Surface.accent} />
            <Text size="sm" weight="semibold" color={Surface.accent}>
              {tr("compare.cta", { count: compareCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {detail.aliasCodes.length > 0 ? (
        <View style={styles.aliasRow}>
          <Text size="sm" color={Surface.dimmed}>
            Also known as
          </Text>
          {detail.aliasCodes.map((aliasCode) => (
            <Pressable
              key={aliasCode}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: "/explore/course/[code]", params: { code: aliasCode } })
              }
              style={({ pressed }) => [styles.aliasChip, pressed && styles.metadataBadgePressed]}
            >
              <Text size="sm" weight="semibold" color={Surface.accent}>
                {aliasCode}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {addDisabled ? (
        <View style={styles.prereqNotice}>
          <AppIcon name="exclamationmark.triangle" size={15} color={Surface.warning} />
          <View style={styles.prereqNoticeText}>
            <Text size="sm" color={Surface.label}>
              You don't meet the prerequisites for this course yet, so it can't be added to your
              basket.
            </Text>
          </View>
        </View>
      ) : null}

      {compareLimitReached ? (
        <View style={styles.compareNotice}>
          <AppIcon name="exclamationmark.triangle" size={15} color={Surface.warning} />
          <Text size="sm" color={Surface.label}>
            {tr("compare.limitReached", { max: MAX_COMPARE_ITEMS })}
          </Text>
        </View>
      ) : null}

      {/*
        Force a single column even on wide tablets: the professors list is
        unbounded in height, so a 2-column split pairs it in a row with a short
        summary card and stretches that card's column to match — leaving a large
        empty gap. A single vertical flow reads cleanly at every width.
      */}
      <ResponsiveColumns maxColumns={1}>
        <CourseDescriptionSection
          courseCode={course.code}
          facultyId={discipline?.facultyId ?? null}
        />

        {prereqGraph ? (
          <SectionCard title={tr("explore.course.prereqs")}>
            <CoursePrereqGraph graph={prereqGraph} onNavigateCourse={navigateCourse} />
          </SectionCard>
        ) : null}

        {scheduleTerms.length > 0 ? (
          <SectionCard title="Weekly schedule">
            <View style={styles.termList}>
              {scheduleTerms.map((termId) => (
                <Pressable
                  key={termId}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/explore/course/[code]/schedule",
                      params: { code: course.code, term: String(termId) },
                    })
                  }
                  style={({ pressed }) => [styles.termRow, pressed && styles.termRowPressed]}
                >
                  <View style={styles.termRowLeft}>
                    <AppIcon name="calendar" size={16} color={Surface.accent} />
                    <Text size="sm" weight="bold">
                      {formatTermLabel(termId)}
                    </Text>
                  </View>
                  <AppIcon name="chevron.right" size={12} color={Surface.dimmed} />
                </Pressable>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {feedbackViews.length > 0 ? (
          <FeedbackSummaryCard
            views={feedbackViews}
            onPress={() =>
              router.push({
                pathname: "/explore/course/[code]/feedback",
                params: { code: course.code },
              })
            }
          />
        ) : null}

        {course.gradeViz ? (
          <SectionCard title="Grade distribution">
            <GradeHistogram gradeViz={course.gradeViz} showSummary showStudentCount />
          </SectionCard>
        ) : null}

        {professors.length > 0 ? (
          <View style={styles.professorsSection}>
            <Text size="sm" weight="bold" color={Surface.label}>
              Professors
            </Text>
            <CollapsibleList entries={professorEntries} />
          </View>
        ) : null}
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  actionFabRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  termList: {
    gap: Spacing.one,
  },
  termRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },
  termRowPressed: {
    opacity: 0.6,
  },
  termRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
  metadataBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  metadataBadge: {
    alignItems: "center",
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    maxWidth: "100%",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  metadataBadgePressed: {
    opacity: 0.72,
  },
  catalogueBadge: {
    gap: Spacing.one,
  },
  compareBadge: {
    gap: Spacing.one,
  },
  aliasRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  aliasChip: {
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  prereqNotice: {
    alignItems: "center",
    backgroundColor: Surface.warningSoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  prereqNoticeText: {
    flex: 1,
  },
  compareNotice: {
    alignItems: "center",
    backgroundColor: Surface.warningSoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  professorsSection: {
    gap: Spacing.two,
  },
  professorStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: 4,
  },
  professorHistogram: {
    marginTop: Spacing.two,
  },
  professorPanel: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  professorLink: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
  },
  professorLinkText: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
});

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { DetailRow } from "@/components/detail-row";
import { type CollapsibleEntry, CollapsibleList } from "@/components/explore/collapsible-list";
import { GradeHistogram } from "@/components/grade-histogram";
import { ResponsiveColumns } from "@/components/layout";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { aggregateGradeViz } from "@/data/discipline-grade-viz";
import { disciplineCourseProfessors, disciplineDetail } from "@/data/explore-detail";

/** Discipline detail — full-bleed course accordion; each course expands to the
 *  professors who have taught it (mirrors the web discipline page). */
export default function DisciplineDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = String(params.code ?? "");
  const { bundle, index } = useAppData();
  const detail = useMemo(() => disciplineDetail(index, code), [index, code]);
  const profsByCourse = useMemo(
    () => (detail ? disciplineCourseProfessors(bundle, detail.discipline.code) : null),
    [bundle, detail],
  );
  const headerGradeViz = useMemo(
    () => (detail ? aggregateGradeViz(detail.courses) : null),
    [detail],
  );

  const faculty = useMemo(() => {
    if (!detail?.discipline.facultyId) return null;
    return index.faculties.find((f) => f.id === detail.discipline.facultyId) ?? null;
  }, [index, detail]);

  if (!detail) {
    return (
      <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
        <ScreenHeader title={code || "Discipline"} />
        <Text dimmed>This discipline isn’t in the loaded catalogue.</Text>
      </RedesignScreen>
    );
  }

  const { discipline, courses } = detail;

  const entries: CollapsibleEntry[] = courses.map((course) => {
    const profs = profsByCourse?.get(course.code) ?? [];
    return {
      key: course.code,
      code: course.code,
      title: course.title,
      meta: course.gpa != null ? `${course.gpa.toFixed(1)} avg` : undefined,
      gradeViz: course.gradeViz,
      body:
        profs.length > 0 ? (
          <>
            {profs.map((prof) => (
              <DetailRow
                key={prof.slug ?? prof.name}
                title={prof.name}
                meta={
                  (prof.gpa != null ? `${prof.gpa.toFixed(1)} avg` : `${prof.graded} grades`) +
                  (prof.rating != null ? ` · ★ ${prof.rating.toFixed(1)}` : "")
                }
                gradeViz={prof.gradeViz}
                onPress={
                  prof.slug
                    ? () =>
                        router.push({
                          pathname: "/explore/professor/[slug]",
                          params: { slug: prof.slug as string },
                        })
                    : undefined
                }
              />
            ))}
            <Pressable
              onPress={() =>
                router.push({ pathname: "/explore/course/[code]", params: { code: course.code } })
              }
              accessibilityRole="button"
              style={styles.openCourse}
            >
              <Text size="sm" weight="bold" color={Surface.accent}>
                Open course →
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.noData}>
            <Text size="sm" dimmed>
              No grade data yet.
            </Text>
          </View>
        ),
    };
  });

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
      <ScreenHeader title={discipline.code} subtitle={discipline.name} />

      <View style={styles.metaRow}>
        {faculty ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/explore/faculty/[id]", params: { id: faculty.id } })
            }
            accessibilityRole="button"
            style={styles.facultyBadge}
          >
            <Text size="sm" color={Surface.label} numberOfLines={1}>
              {faculty.name}
            </Text>
          </Pressable>
        ) : null}
        <Text size="xs" color={Surface.dimmed}>
          {discipline.courseCount.toLocaleString()} courses · {discipline.graded.toLocaleString()}{" "}
          grades
        </Text>
      </View>

      <ResponsiveColumns gap={Spacing.three}>
        <SectionCard title="Grade distribution">
          {headerGradeViz ? (
            <GradeHistogram gradeViz={headerGradeViz} showSummary showStudentCount maxBarPx={112} />
          ) : (
            <View style={styles.noData}>
              <Text size="sm" dimmed>
                No grade data yet.
              </Text>
            </View>
          )}
        </SectionCard>

        <CollapsibleList entries={entries} />
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    gap: Spacing.two,
  },
  facultyBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: Surface.subtle,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  openCourse: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  noData: {
    paddingVertical: Spacing.two,
  },
});

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { DetailRow } from "@/components/detail-row";
import { type CollapsibleEntry, CollapsibleList } from "@/components/explore/collapsible-list";
import { GradeHistogram } from "@/components/grade-histogram";
import { ResponsiveColumns } from "@/components/layout";
import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { aggregateGradeViz } from "@/data/discipline-grade-viz";
import { disciplineDetail, facultyDetail } from "@/data/explore-detail";

/** Faculty detail — full-bleed discipline accordion; each discipline carries a
 *  merged grade-viz bar and expands to its courses (mirrors the web faculty
 *  page, where expanding a discipline reveals only its courses). */
export default function FacultyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? "");
  const { index } = useAppData();
  const detail = useMemo(() => facultyDetail(index, id), [index, id]);

  const entries = useMemo<CollapsibleEntry[]>(() => {
    if (!detail) return [];
    return detail.disciplines.map((discipline) => {
      const courses = disciplineDetail(index, discipline.code)?.courses ?? [];
      const disciplineGradeViz = aggregateGradeViz(courses);
      return {
        key: discipline.code,
        code: discipline.code,
        title: discipline.name,
        meta: `${discipline.graded.toLocaleString()} grades`,
        gradeViz: disciplineGradeViz,
        body: (
          <View style={styles.disciplinePanel}>
            {disciplineGradeViz ? (
              <View style={styles.panelHistogram}>
                <Text size="sm" weight="bold" color={Surface.label}>
                  Grade distribution
                </Text>
                <GradeHistogram
                  gradeViz={disciplineGradeViz}
                  maxBarPx={56}
                  showSummary
                  hideLabels
                  density="compact"
                />
              </View>
            ) : (
              <View style={styles.noData}>
                <Text size="sm" dimmed>
                  No grade data yet.
                </Text>
              </View>
            )}
            {courses.length > 0 ? (
              courses.map((course) => (
                <DetailRow
                  key={course.code}
                  title={course.code}
                  subtitle={course.title}
                  meta={course.gpa != null ? `${course.gpa.toFixed(1)} avg` : undefined}
                  gradeViz={course.gradeViz}
                  onPress={() =>
                    router.push({
                      pathname: "/explore/course/[code]",
                      params: { code: course.code },
                    })
                  }
                />
              ))
            ) : (
              <View style={styles.noData}>
                <Text size="sm" dimmed>
                  No courses with grade data yet.
                </Text>
              </View>
            )}
          </View>
        ),
      };
    });
  }, [detail, index, router]);

  if (!detail) {
    return (
      <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
        <ScreenHeader title="Faculty" />
        <Text dimmed>This faculty isn’t in the loaded catalogue.</Text>
      </RedesignScreen>
    );
  }

  const { faculty } = detail;

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
      <ScreenHeader title={faculty.name} />

      <ResponsiveColumns gap={Spacing.three}>
        <Text size="xs" color={Surface.dimmed}>
          {faculty.disciplineCount.toLocaleString()} disciplines · {faculty.graded.toLocaleString()}{" "}
          grades
        </Text>

        <CollapsibleList entries={entries} />
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  disciplinePanel: {
    gap: Spacing.two,
  },
  panelHistogram: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  noData: {
    paddingVertical: Spacing.two,
  },
});

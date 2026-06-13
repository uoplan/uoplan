import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { distributionGpa, normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { Stack, Text, TextInput, Title } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GradeHistogram } from "@/components/grade-histogram";
import { ScreenScaffold } from "@/components/screen-scaffold";
import { Spacing, Surface } from "@/constants/theme";
import { SAMPLE_GRADES_BY_CODE } from "@/data/sample-grades";

interface SampleCourse {
  code: string;
  title: string;
  faculty: string;
}

const FACULTIES = [
  "Engineering",
  "Science",
  "Arts",
  "Social Sciences",
  "Health Sciences",
  "Management",
] as const;

const SAMPLE_COURSES: SampleCourse[] = [
  { code: "ITI 1120", title: "Introduction to Computing", faculty: "Engineering" },
  { code: "CSI 2110", title: "Data Structures and Algorithms", faculty: "Engineering" },
  { code: "MAT 1320", title: "Calculus I", faculty: "Science" },
  { code: "BIO 1130", title: "Introduction to Organismal Biology", faculty: "Science" },
  { code: "PHI 1101", title: "Reasoning and Critical Thinking", faculty: "Arts" },
  { code: "ENG 1112", title: "Technical Report Writing", faculty: "Arts" },
  { code: "PSY 1101", title: "Introduction to Psychology", faculty: "Social Sciences" },
  { code: "ECO 1104", title: "Introduction to Microeconomics", faculty: "Social Sciences" },
  { code: "HSS 1100", title: "Foundations of Health Sciences", faculty: "Health Sciences" },
  { code: "ADM 1100", title: "Introduction to Business Management", faculty: "Management" },
];

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text size="sm" weight="medium" color={active ? "#ffffff" : Surface.label}>
        {label}
      </Text>
    </Pressable>
  );
}

function CourseRow({
  course,
  expanded,
  onToggle,
}: {
  course: SampleCourse;
  expanded: boolean;
  onToggle: () => void;
}) {
  const distribution = SAMPLE_GRADES_BY_CODE[course.code];
  const gradeViz = useMemo(
    () => (distribution ? normalizeGradeVizDistribution(distribution) : null),
    [distribution],
  );
  const gpa = useMemo(() => (distribution ? distributionGpa(distribution) : null), [distribution]);

  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.courseRow}
      >
        <View style={styles.courseCode}>
          <Text size="xs" weight="bold" color={Surface.accent}>
            {course.code}
          </Text>
        </View>
        <View style={styles.courseBody}>
          <Text size="md" weight="medium">
            {course.title}
          </Text>
          <Text size="sm" dimmed>
            {course.faculty}
          </Text>
        </View>
        {gpa != null ? (
          <View style={styles.gpaChip}>
            <Text size="xs" weight="semibold" color={Surface.accent}>
              {gpa.toFixed(2)}
            </Text>
          </View>
        ) : null}
        <AppIcon name={expanded ? "chevron.up" : "chevron.down"} size={14} color={Surface.dimmed} />
      </Pressable>

      {expanded ? (
        <View style={styles.expanded}>
          {gradeViz ? (
            <GradeHistogram gradeViz={gradeViz} maxBarPx={64} showSummary showStudentCount />
          ) : (
            <Text size="sm" dimmed>
              No grade data available for this course yet.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Explore tab — search + browse entry point. A search field and faculty chips
 * filter a sample course list client-side. Live catalogue data (and deep links
 * into course/discipline/professor pages) arrive with the shared data layer; for
 * now this gives a real, interactive browse surface.
 */
export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_COURSES.filter((course) => {
      const matchesFaculty = faculty === null || course.faculty === faculty;
      const matchesQuery =
        q === "" || course.code.toLowerCase().includes(q) || course.title.toLowerCase().includes(q);
      return matchesFaculty && matchesQuery;
    });
  }, [query, faculty]);

  return (
    <ScreenScaffold title="Explore" subtitle="Search courses, programs and professors">
      <TextInput placeholder="Search by code or title…" value={query} onChangeText={setQuery} />

      <Stack gap="sm">
        <Title order={4}>Browse by faculty</Title>
        <View style={styles.chipRow}>
          <Chip label="All" active={faculty === null} onPress={() => setFaculty(null)} />
          {FACULTIES.map((name) => (
            <Chip
              key={name}
              label={name}
              active={faculty === name}
              onPress={() => setFaculty((current) => (current === name ? null : name))}
            />
          ))}
        </View>
      </Stack>

      <Stack gap="sm">
        <Title order={4}>{faculty ?? "Popular"} courses</Title>
        {results.length > 0 ? (
          <View style={styles.list}>
            {results.map((course, index) => (
              <View key={course.code}>
                {index > 0 ? <View style={styles.separator} /> : null}
                <CourseRow
                  course={course}
                  expanded={expandedCode === course.code}
                  onToggle={() =>
                    setExpandedCode((current) => (current === course.code ? null : course.code))
                  }
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text dimmed align="center">
              No courses match “{query}”.
            </Text>
          </View>
        )}
      </Stack>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  chipActive: {
    backgroundColor: Surface.accent,
    borderColor: Surface.accent,
  },
  list: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    overflow: "hidden",
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  courseCode: {
    minWidth: 64,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    backgroundColor: Surface.subtle,
    alignItems: "center",
  },
  courseBody: {
    flex: 1,
    gap: 2,
  },
  gpaChip: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
  },
  expanded: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.one,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
    marginLeft: Spacing.three + 64 + Spacing.three,
  },
  empty: {
    paddingVertical: Spacing.five,
  },
});

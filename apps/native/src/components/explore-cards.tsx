import { Pressable, StyleSheet, View } from "react-native";

import type { GradeVizData } from "@uoplan/core/gradeDistribution";
import { Text } from "@uoplan/ui";

import { GradeVizBar } from "@/components/grade-viz-bar";
import { RatingBadge, RatingBadgeRow } from "@/components/rating-badge";
import { Spacing, Surface } from "@/constants/theme";
import type {
  ExploreCourseEntry,
  ExploreDisciplineEntry,
  ExploreFacultyEntry,
  ExploreProfessorEntry,
  ExploreProgramEntry,
} from "@/data/explore-index";

export const CARD_WIDTH = 200;

const LETTER_GRADES = new Set(["F", "E", "D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"]);

/** The single most-awarded letter grade in a distribution (mirrors web `mostCommonGrade`). */
function mostCommonGrade(gradeViz: GradeVizData): string | null {
  return (
    gradeViz.histogram
      .filter((h) => LETTER_GRADES.has(h.grade) && h.count > 0)
      .reduce<{ grade: string; count: number } | null>(
        (best, h) => (best === null || h.count > best.count ? h : best),
        null,
      )?.grade ?? null
  );
}

function formatThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "B+ · 87% passing" summary line — the native leaf of web `SearchResultGradeSummary`. */
function GradeSummary({ gradeViz }: { gradeViz: GradeVizData | null }) {
  if (!gradeViz || gradeViz.total <= 0) {
    return (
      <Text size="xs" color={Surface.dimmed}>
        No grade data
      </Text>
    );
  }
  const grade = mostCommonGrade(gradeViz);
  const passing = Math.round(gradeViz.passingPercent);
  return (
    <Text size="xs" color={Surface.dimmed}>
      {grade ? (
        <Text size="xs" weight="bold" color={Surface.label}>
          {grade}
        </Text>
      ) : null}
      {grade ? " · " : ""}
      {passing}% passing
    </Text>
  );
}

interface BaseCardProps {
  selected?: boolean;
  onPress?: () => void;
  width?: number;
  gradeViz?: GradeVizData | null;
  /** When false, omit the flush bottom grade bar (e.g. programs carry no grades). */
  showGradeBar?: boolean;
  children: React.ReactNode;
}

/**
 * Shared chrome for every explore search-result card: a fixed-width, equal-height
 * pressable with a padded body (top content + a flex spacer pinning the meta to the
 * bottom) and a flush grade-distribution bar at the very bottom edge — the native
 * analogue of the web `EXPLORE_RESULT_CARD_STYLE` + `GradeDistributionBottomBar`.
 */
function BaseCard({
  selected,
  onPress,
  width = CARD_WIDTH,
  gradeViz,
  showGradeBar = true,
  children,
}: BaseCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.card, { width }, selected && styles.cardSelected]}
    >
      <View style={styles.body}>{children}</View>
      {showGradeBar ? <GradeVizBar gradeViz={gradeViz} height={4} flush /> : null}
    </Pressable>
  );
}

/** Course result card: code, title (2-line clamp), optional stat, satisfaction badge, grade summary. */
export function CourseResultCard({
  course,
  stat,
  sentiment,
  selected,
  onPress,
  width,
}: {
  course: ExploreCourseEntry;
  /** Spotlight metric to surface (search results pass none → grade summary only). */
  stat?: "gpa" | "fail" | "graded";
  sentiment?: number | null;
  selected?: boolean;
  onPress?: () => void;
  width?: number;
}) {
  const statLabel =
    stat === "fail"
      ? `${Math.round(course.failRate * 100)}% fail`
      : stat === "graded"
        ? `${formatThousands(course.graded)} grades`
        : stat === "gpa" && course.gpa != null
          ? `${course.gpa.toFixed(1)} avg`
          : null;
  return (
    <BaseCard selected={selected} onPress={onPress} width={width} gradeViz={course.gradeViz}>
      <Text size="sm" weight="bold" color={Surface.accent} numberOfLines={1}>
        {course.code}
      </Text>
      <Text size="xs" dimmed numberOfLines={2}>
        {course.title}
      </Text>
      <View style={styles.spacer} />
      {statLabel ? (
        <Text size="xs" weight="semibold" color={Surface.label}>
          {statLabel}
        </Text>
      ) : null}
      {sentiment != null && sentiment > 0 ? (
        <RatingBadge kind="satisfaction" value={sentiment} />
      ) : null}
      <GradeSummary gradeViz={course.gradeViz} />
    </BaseCard>
  );
}

/** Professor result card: name (2-line clamp), graded count, satisfaction + ★ badges, grade summary. */
export function ProfessorResultCard({
  professor,
  sentiment,
  selected,
  onPress,
  width,
}: {
  professor: ExploreProfessorEntry;
  sentiment?: number | null;
  selected?: boolean;
  onPress?: () => void;
  width?: number;
}) {
  return (
    <BaseCard selected={selected} onPress={onPress} width={width} gradeViz={professor.gradeViz}>
      <Text size="sm" weight="bold" numberOfLines={2}>
        {professor.name}
      </Text>
      {professor.graded > 0 ? (
        <Text size="xs" dimmed numberOfLines={1}>
          {formatThousands(professor.graded)} grades
        </Text>
      ) : null}
      <View style={styles.spacer} />
      <RatingBadgeRow satisfaction={sentiment} rmp={professor.rating} />
      <GradeSummary gradeViz={professor.gradeViz} />
    </BaseCard>
  );
}

/** Discipline result card: code, name (3-line clamp), satisfaction badge, course count. */
export function DisciplineResultCard({
  discipline,
  sentiment,
  selected,
  onPress,
  width,
}: {
  discipline: ExploreDisciplineEntry;
  sentiment?: number | null;
  selected?: boolean;
  onPress?: () => void;
  width?: number;
}) {
  return (
    <BaseCard selected={selected} onPress={onPress} width={width} gradeViz={discipline.gradeViz}>
      <Text size="sm" weight="bold" color={Surface.accent} numberOfLines={1}>
        {discipline.code}
      </Text>
      <Text size="xs" dimmed numberOfLines={3}>
        {discipline.name}
      </Text>
      <View style={styles.spacer} />
      {sentiment != null && sentiment > 0 ? (
        <RatingBadge kind="satisfaction" value={sentiment} />
      ) : null}
      <Text size="xs" color={Surface.dimmed}>
        {discipline.courseCount} {discipline.courseCount === 1 ? "course" : "courses"}
      </Text>
    </BaseCard>
  );
}

/** Faculty result card: name (3-line clamp), satisfaction badge, discipline count. */
export function FacultyResultCard({
  faculty,
  sentiment,
  selected,
  onPress,
  width,
}: {
  faculty: ExploreFacultyEntry;
  sentiment?: number | null;
  selected?: boolean;
  onPress?: () => void;
  width?: number;
}) {
  return (
    <BaseCard selected={selected} onPress={onPress} width={width} gradeViz={faculty.gradeViz}>
      <Text size="sm" weight="bold" numberOfLines={3}>
        {faculty.name}
      </Text>
      <View style={styles.spacer} />
      {sentiment != null && sentiment > 0 ? (
        <RatingBadge kind="satisfaction" value={sentiment} />
      ) : null}
      <Text size="xs" color={Surface.dimmed}>
        {faculty.disciplineCount} {faculty.disciplineCount === 1 ? "discipline" : "disciplines"}
      </Text>
    </BaseCard>
  );
}

/** Program result card: title (4-line clamp) + "PROGRAM" label (programs carry no grade data). */
export function ProgramResultCard({
  program,
  onPress,
  width,
}: {
  program: ExploreProgramEntry;
  onPress?: () => void;
  width?: number;
}) {
  return (
    <BaseCard onPress={onPress} width={width} showGradeBar={false}>
      <Text size="sm" weight="bold" numberOfLines={4}>
        {program.title}
      </Text>
      <View style={styles.spacer} />
      <Text size="xs" color={Surface.dimmed}>
        PROGRAM
      </Text>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 168,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: Surface.accent,
  },
  body: {
    flex: 1,
    gap: 5,
    padding: Spacing.three,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.two,
  },
});

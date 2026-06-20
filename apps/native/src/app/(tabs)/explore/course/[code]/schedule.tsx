import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { DAY_LABELS } from "@uoplan/calendar/layout";
import type { CalendarEvent } from "@uoplan/calendar/types";
import type { ComponentSection } from "@uoplan/core/dataTypes";
import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { buildProfessorRegistry } from "@uoplan/core/professorRegistry";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { Text } from "@uoplan/ui";

import { CalendarEventDrawer } from "@/components/calendar-event-drawer";
import { GradeVizBar } from "@/components/grade-viz-bar";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { WeekCalendar } from "@/components/week-calendar";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import {
  courseScheduleDetail,
  courseScheduleSectionId,
  defaultCourseSectionSelection,
  sectionOverlapsSelection,
  selectedCourseScheduleEvents,
  type CourseSectionSelection,
} from "@/data/explore-detail";
import {
  explainUnpredictedInstructors,
  professorSlugForUnpredicted,
  type UnpredictedInstructor,
  unpredictedReasonLabel,
} from "@/data/course-schedule-prediction";
import { formatTermLabel } from "@/data/trends-data";

function paramKey(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join("/") : (value ?? "");
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeLabel(time: {
  day: CalendarEvent["day"];
  startMinutes: number;
  endMinutes: number;
  virtual: boolean;
}): string {
  const base = `${DAY_LABELS[time.day]} · ${formatMinutes(time.startMinutes)}–${formatMinutes(
    time.endMinutes,
  )}`;
  return time.virtual ? `${base} · Online` : base;
}

function isKnownInstructor(name: string | null | undefined): name is string {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !/^(staff|tba|to be announced|unknown)$/iu.test(trimmed);
}

function sectionInstructorNames(section: ComponentSection): string[] {
  return [...new Set(section.times.map((time) => time.instructor).filter(isKnownInstructor))];
}

function predictedInstructorNames(section: ComponentSection): string[] {
  return [
    ...new Set(
      (section.predictedInstructors ?? [])
        .map((instructor) => instructor.name.trim())
        .filter((name) => name.length > 0),
    ),
  ];
}

function explanationKey(component: string, section: ComponentSection): string {
  return `${component}:${courseScheduleSectionId(section)}`;
}

type UnpredictedInstructorLink = UnpredictedInstructor & { slug: string };

function SectionOption({
  section,
  selected,
  overlaps,
  courseFallbackDistribution,
  unpredictedInstructors,
  onOpenProfessor,
  onPress,
}: {
  section: ComponentSection;
  selected: boolean;
  overlaps: boolean;
  courseFallbackDistribution: Record<string, number> | null;
  unpredictedInstructors: UnpredictedInstructorLink[];
  onOpenProfessor: (slug: string) => void;
  onPress: () => void;
}) {
  const [showUnpredicted, setShowUnpredicted] = useState(false);
  const sectionCode = courseScheduleSectionId(section);
  const instructors = sectionInstructorNames(section);
  const predictedNames = instructors.length === 0 ? predictedInstructorNames(section) : [];
  const validTimes = section.times.filter((time) => time.startMinutes < time.endMinutes);
  const gradeViz =
    normalizeGradeVizDistribution(section.distribution ?? null) ??
    normalizeGradeVizDistribution(courseFallbackDistribution);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionOption,
        selected && styles.sectionOptionSelected,
        pressed && styles.sectionOptionPressed,
      ]}
    >
      <View style={styles.sectionOptionBody}>
        <View style={styles.sectionHead}>
          <Text size="sm" weight="bold" color={selected ? Surface.accent : Surface.label}>
            {sectionCode}
          </Text>
          <View style={styles.badges}>
            {overlaps ? (
              <View style={[styles.badge, styles.overlapBadge]}>
                <Text size="xs" weight="semibold" color={Surface.warning}>
                  Overlaps
                </Text>
              </View>
            ) : null}
            {section.status ? (
              <View style={styles.badge}>
                <Text size="xs" weight="semibold" color={Surface.dimmed}>
                  {section.status}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {instructors.length > 0 ? (
          <Text size="sm" dimmed numberOfLines={1}>
            {instructors.join(", ")}
          </Text>
        ) : predictedNames.length > 0 ? (
          <View style={styles.predictedRow}>
            <View style={styles.predictedBadge}>
              <Text size="xs" weight="semibold" color={Surface.accent}>
                Predicted
              </Text>
            </View>
            <Text size="sm" dimmed numberOfLines={1}>
              {predictedNames.join(", ")}
            </Text>
          </View>
        ) : null}

        {predictedNames.length > 0 && unpredictedInstructors.length > 0 ? (
          <View style={styles.predictionDisclosure}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showUnpredicted }}
              onPress={(event) => {
                event.stopPropagation();
                setShowUnpredicted((current) => !current);
              }}
              style={({ pressed }) => [styles.whyButton, pressed && styles.whyButtonPressed]}
            >
              <Text size="xs" weight="semibold" color={Surface.accent}>
                {showUnpredicted ? "Hide explanation" : "Why not others?"}
              </Text>
            </Pressable>

            {showUnpredicted ? (
              <View style={styles.unpredictedList}>
                {unpredictedInstructors.map((instructor) => (
                  <View
                    key={`${instructor.slug}-${instructor.name}`}
                    style={styles.unpredictedItem}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${instructor.name}`}
                      onPress={(event) => {
                        event.stopPropagation();
                        onOpenProfessor(instructor.slug);
                      }}
                      style={({ pressed }) => [
                        styles.unpredictedNameLink,
                        pressed && styles.whyButtonPressed,
                      ]}
                    >
                      <Text size="xs" weight="bold" color={Surface.accent}>
                        {instructor.name}
                      </Text>
                    </Pressable>
                    <Text size="xs" color={Surface.dimmed}>
                      {unpredictedReasonLabel(instructor.reason)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {validTimes.length > 0 ? (
          <View style={styles.timeRows}>
            {validTimes.map((time, index) => (
              <Text key={index} size="xs" color={Surface.dimmed}>
                {timeLabel(time)}
              </Text>
            ))}
          </View>
        ) : (
          <Text size="xs" color={Surface.dimmed}>
            No meeting time
          </Text>
        )}
      </View>
      <GradeVizBar gradeViz={gradeViz} height={5} flush />
    </Pressable>
  );
}

/** Weekly meeting grid and selectable section cards for one loaded course schedule. */
export default function CourseScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; term?: string | string[] }>();
  const { bundle, index, schedulesByTerm } = useAppData();
  const code = paramKey(params.code);
  const term = paramKey(params.term);
  const detail = useMemo(
    () => courseScheduleDetail(schedulesByTerm, params.code, params.term),
    [schedulesByTerm, code, term, params.code, params.term],
  );
  const [selected, setSelected] = useState<{ event: CalendarEvent; color: string } | null>(null);
  const [selection, setSelection] = useState<CourseSectionSelection>({});
  const professorRegistry = useMemo(
    () => buildProfessorRegistry(bundle.professors),
    [bundle.professors],
  );

  const titleByCode = useMemo(
    () =>
      new Map(
        bundle.catalogue.courses.map((course) => [normalizeCourseCode(course.code), course.title]),
      ),
    [bundle],
  );

  const courseFallbackDistribution = useMemo(() => {
    const rawCode = detail?.course.courseCode ?? code;
    if (!rawCode) return null;
    const normalized = normalizeCourseCode(rawCode);
    return (
      index.courses.find((course) => normalizeCourseCode(course.code) === normalized)
        ?.distribution ?? null
    );
  }, [code, detail?.course.courseCode, index]);

  useEffect(() => {
    setSelection(detail ? defaultCourseSectionSelection(detail.course) : {});
  }, [detail?.course]);

  const previewEvents = useMemo(
    () =>
      detail
        ? selectedCourseScheduleEvents(detail.course, selection, courseFallbackDistribution)
        : [],
    [courseFallbackDistribution, detail, selection],
  );

  const unpredictedBySection = useMemo(() => {
    const bySection = new Map<string, UnpredictedInstructorLink[]>();
    if (!detail) return bySection;

    const courseCode = normalizeCourseCode(detail.course.courseCode);
    const courseGrades =
      bundle.grades.courses.find((entry) => normalizeCourseCode(entry.code) === courseCode)
        ?.sections ?? [];
    if (courseGrades.length === 0) return bySection;

    const termIdNumber = Number(detail.termId);
    const termSchedules = schedulesByTerm.get(String(detail.termId))?.schedules ?? [];
    if (!Number.isFinite(termIdNumber) || termSchedules.length === 0) return bySection;

    for (const [component, sections] of Object.entries(detail.course.components)) {
      for (const section of sections) {
        const predicted = section.predictedInstructors ?? [];
        if (
          sectionInstructorNames(section).length > 0 ||
          predictedInstructorNames(section).length === 0
        ) {
          continue;
        }

        const explanations = explainUnpredictedInstructors({
          courseCode,
          section,
          termSchedules,
          termId: termIdNumber,
          courseGrades,
          predicted,
          maxReasons: 6,
        });
        if (explanations.length === 0) continue;

        bySection.set(
          explanationKey(component, section),
          explanations.map((instructor) => ({
            ...instructor,
            slug: professorSlugForUnpredicted(professorRegistry, instructor),
          })),
        );
      }
    }

    return bySection;
  }, [bundle.grades.courses, detail, professorRegistry, schedulesByTerm]);

  if (!detail) {
    return (
      <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
        <ScreenHeader title={code || "Course schedule"} />
        <Text dimmed>This course has no loaded meeting schedule for the selected term.</Text>
      </RedesignScreen>
    );
  }

  const { course, meetingCount, sectionCount, termId } = detail;
  const components = Object.entries(course.components).sort(([a], [b]) => a.localeCompare(b, "en"));

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Explore" onBack={() => router.back()}>
      <ScreenHeader title={course.courseCode} subtitle={course.title ?? "Course schedule"} />

      <Text size="xs" color={Surface.dimmed}>
        {formatTermLabel(Number(termId))} · {sectionCount.toLocaleString()} section
        {sectionCount === 1 ? "" : "s"} · {meetingCount.toLocaleString()} meeting
        {meetingCount === 1 ? "" : "s"}
      </Text>

      <SectionCard title="Weekly schedule">
        {previewEvents.length > 0 ? (
          <WeekCalendar
            events={previewEvents}
            heightPerHour={44}
            onEventPress={(event, color) => setSelected({ event, color })}
          />
        ) : (
          <Text size="sm" dimmed>
            This course is loaded for the term, but its sections do not include meeting times.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="Sections">
        <View style={styles.components}>
          {components.map(([component, sections]) => (
            <View key={component} style={styles.componentGroup}>
              <Text size="sm" weight="bold" color={Surface.label}>
                {component}
              </Text>
              <View style={styles.sectionOptions}>
                {sections.map((section) => {
                  const sectionCode = courseScheduleSectionId(section);
                  const isSelected = selection[component] === sectionCode;
                  const overlaps = sectionOverlapsSelection(course, selection, component, section);
                  return (
                    <SectionOption
                      key={`${component}-${sectionCode}`}
                      section={section}
                      selected={isSelected}
                      overlaps={overlaps}
                      courseFallbackDistribution={courseFallbackDistribution}
                      unpredictedInstructors={
                        unpredictedBySection.get(explanationKey(component, section)) ?? []
                      }
                      onOpenProfessor={(slug) =>
                        router.push({
                          pathname: "/explore/professor/[slug]",
                          params: { slug },
                        })
                      }
                      onPress={() =>
                        setSelection((current) => ({
                          ...current,
                          [component]: sectionCode,
                        }))
                      }
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      <CalendarEventDrawer
        event={selected?.event ?? null}
        accentColor={selected?.color}
        courseTitle={
          titleByCode.get(normalizeCourseCode(course.courseCode)) ?? course.title ?? undefined
        }
        onClose={() => setSelected(null)}
        onViewCourse={(nextCode) =>
          router.push({ pathname: "/explore/course/[code]", params: { code: nextCode } })
        }
      />
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  components: {
    gap: Spacing.three,
  },
  componentGroup: {
    gap: Spacing.two,
  },
  sectionOptions: {
    gap: Spacing.two,
  },
  sectionOption: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.subtle,
    overflow: "hidden",
  },
  sectionOptionSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accentSoft,
  },
  sectionOptionPressed: {
    opacity: 0.72,
  },
  sectionOptionBody: {
    gap: 6,
    padding: Spacing.two,
  },
  sectionHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  badges: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: Spacing.one,
    justifyContent: "flex-end",
  },
  badge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  overlapBadge: {
    borderColor: Surface.warning,
  },
  predictedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.one,
  },
  predictedBadge: {
    borderRadius: 999,
    backgroundColor: Surface.accentSoft,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  predictionDisclosure: {
    alignItems: "flex-start",
    gap: Spacing.one,
  },
  whyButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.accent,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  whyButtonPressed: {
    opacity: 0.7,
  },
  unpredictedList: {
    alignSelf: "stretch",
    gap: Spacing.one,
    paddingTop: 2,
  },
  unpredictedItem: {
    gap: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  unpredictedNameLink: {
    alignSelf: "flex-start",
  },
  timeRows: {
    gap: 2,
  },
});

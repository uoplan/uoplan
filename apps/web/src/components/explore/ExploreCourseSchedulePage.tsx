import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Anchor,
  Badge,
  Box,
  Flex,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertTriangle, IconTargetArrow, IconVideo } from "@tabler/icons-react";
import {
  buildColorMap,
  collectTimes,
  explainUnpredictedInstructors,
  getEnrollmentsForCourse,
  getValidSectionCombos,
  knownSectionInstructors,
  normalizeCourseCode,
  normalizeGradeVizDistribution,
  sectionHasTimes,
  sectionsHaveInternalOverlap,
  timesOverlap,
} from "@uoplan/core";
import type {
  ComponentSection,
  CourseSchedule,
  GeneratedSchedule,
  SectionCombo,
  UnpredictedInstructor,
} from "@uoplan/core";
import { DAY_LABELS } from "@uoplan/calendar";
import { tr, useTr } from "../../i18n";
import {
  useDataCache,
  useProfessorRatings,
  useProfessorRegistry,
  useRequirementState,
} from "../../store/hooks";
import { usePublishBasketTarget } from "./exploreBasketTargetContext";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
import { useTermScheduleData } from "../../hooks/useTermScheduleData";
import { parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { formatTimeRange } from "../calendar/calendarEventDisplayUtils";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { formatTermLabel } from "../../lib/term/termLabel";
import { WeekCalendar } from "../calendar/WeekCalendar";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { WhyNotPredictedPopover } from "./WhyNotPredictedPopover";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";

function sectionId(section: ComponentSection): string {
  return section.sectionCode ?? section.section;
}

/** Constant calendar heights so the timetable never collapses to the height of a
 * short component list (e.g. a course with a single lecture). */
const CAL_DESKTOP_HEIGHT = 660;
const CAL_MOBILE_HEIGHT = 460;

/** Square section cards, mirroring the Explore search-result cards. */
const SECTION_CARD_SIZE = 160;

/** Pick a sensible default section per component: the first conflict-free combo,
 * else the first section that has real meeting times (else the first listed). */
function defaultSelection(course: CourseSchedule): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const [component, sections] of Object.entries(course.components)) {
    const pick = sections.find(sectionHasTimes) ?? sections[0];
    if (pick) selection[component] = sectionId(pick);
  }
  const combos = getValidSectionCombos(course);
  if (combos[0]) {
    for (const [component, { section }] of Object.entries(combos[0])) {
      selection[component] = sectionId(section);
    }
  }
  return selection;
}

function findCourseSchedule(
  schedules: CourseSchedule[] | undefined,
  normCode: string | null,
): CourseSchedule | null {
  if (!schedules || !normCode) return null;
  return schedules.find((s) => normalizeCourseCode(s.courseCode) === normCode) ?? null;
}

/** A single selectable section card inside a component group. */
function SectionOption({
  section,
  courseFallbackViz,
  selected,
  disabled,
  onSelect,
}: {
  section: ComponentSection;
  courseFallbackViz: ReturnType<typeof normalizeGradeVizDistribution>;
  selected: boolean;
  /** True when picking this section would overlap an already-selected section. */
  disabled: boolean;
  onSelect: () => void;
}) {
  const instructors = [
    ...new Set(
      section.times
        .map((t) => t.instructor)
        .filter((i): i is string => i != null && i.trim().length > 0 && i !== "Staff"),
    ),
  ];
  const timeRows = section.times.filter((t) => t.startMinutes < t.endMinutes);
  const isVirtualOnly = timeRows.length > 0 && timeRows.every((t) => t.virtual);
  const sectionViz =
    normalizeGradeVizDistribution(section.distribution ?? null) ?? courseFallbackViz;
  const interactive = !disabled;

  return (
    <UnstyledButton
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={interactive ? "soft-lift" : undefined}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        borderRadius: "var(--app-radius)",
        border: `var(--app-border-width) solid ${
          selected ? "var(--app-accent)" : "var(--app-border)"
        }`,
        backgroundColor: selected ? "var(--app-accent-subtle)" : "var(--app-surface-sunken)",
        overflow: "hidden",
        transition:
          "background-color var(--app-transition), border-color var(--app-transition), box-shadow var(--app-transition)",
      }}
    >
      <Stack gap={6} p={10} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Group justify="space-between" gap={6} wrap="nowrap">
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <Text size="sm" fw={700} c="var(--app-text)">
              {section.sectionCode ?? section.section}
            </Text>
            {isVirtualOnly ? (
              <IconVideo size={14} stroke={1.6} color="var(--app-text-muted)" />
            ) : null}
          </Group>
          {disabled ? (
            <Badge size="xs" variant="light" color="orange">
              {tr("explore.schedule.overlaps")}
            </Badge>
          ) : section.status ? (
            <Badge size="xs" variant="light" color={selected ? "blue" : "gray"}>
              {section.status}
            </Badge>
          ) : null}
        </Group>
        {instructors.length > 0 ? (
          <Text size="xs" c="dimmed" lh={1.3} truncate>
            {instructors.join(", ")}
          </Text>
        ) : section.predictedInstructors && section.predictedInstructors.length > 0 ? (
          <Text size="xs" c="dimmed" lh={1.3} truncate fs="italic">
            {tr("explore.schedule.predictedInstructors", {
              names: section.predictedInstructors.map((p) => p.name).join(", "),
            })}
          </Text>
        ) : null}
        <Stack gap={2}>
          {timeRows.length > 0 ? (
            timeRows.map((t, i) => (
              <Text key={i} size="xs" c="var(--app-text-muted)" lh={1.3}>
                {DAY_LABELS[t.day]} · {formatTimeRange(t.startMinutes, t.endMinutes)}
                {t.virtual ? ` · ${tr("calendar.event.virtual")}` : ""}
              </Text>
            ))
          ) : (
            <Text size="xs" c="dimmed" lh={1.3}>
              {tr("explore.schedule.noTimes")}
            </Text>
          )}
        </Stack>
      </Stack>
      <GradeDistributionBottomBar gradeViz={sectionViz} />
    </UnstyledButton>
  );
}

type RequirementFit = { hasProgram: boolean; matchCount: number; firstTitle: string | null };

/** Inline hint showing how the course fits the student's remaining requirements. */
function CourseFitHint({ fit }: { fit: RequirementFit }) {
  useTr();
  if (!fit.hasProgram) {
    return (
      <Text size="xs" c="dimmed" lh={1.4} mt={8}>
        {tr("explore.schedule.fit.noProgram")}{" "}
        <Anchor component={Link} to="/personalize" size="xs" fw={600}>
          {tr("basket.noProgram.link")}
        </Anchor>
      </Text>
    );
  }
  if (fit.matchCount === 0) {
    return (
      <Text size="xs" c="var(--app-text-muted)" lh={1.4} mt={8}>
        {tr("explore.schedule.fit.none")}
      </Text>
    );
  }
  const label =
    fit.matchCount === 1 && fit.firstTitle
      ? tr("explore.schedule.fit.counts", { requirement: fit.firstTitle })
      : tr("explore.schedule.fit.countsMany", { count: fit.matchCount });
  return (
    <Group gap={6} wrap="nowrap" mt={8} c="var(--app-success)">
      <IconTargetArrow size={15} stroke={1.8} />
      <Text size="xs" fw={600} lh={1.4}>
        {label}
      </Text>
    </Group>
  );
}

export function ExploreCourseSchedulePage({
  urlCourseParam,
  termId,
}: {
  urlCourseParam: string;
  termId: number | null;
}) {
  useTr();
  const normCode = parseCoursePathParam(urlCourseParam);
  const professorRatings = useProfessorRatings();
  const registry = useProfessorRegistry();
  const cache = useDataCache();
  const { data: courseGrades } = useCourseGradesPb();
  const { remainingRequirements } = useRequirementState();
  const { getCourseEntryByNorm } = useExploreOfferings();
  const { data: schedulesData, loading } = useTermScheduleData(termId);
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });

  const course = useMemo(
    () => findCourseSchedule(schedulesData?.schedules, normCode),
    [schedulesData, normCode],
  );

  // Per unassigned section: why the course's other historical instructors aren't
  // the build-time prediction (time conflict, stale, not teaching this term…).
  // Keyed by `${component}\u0000${sectionId}`; only populated when there's a
  // prediction to contextualise and at least one excluded historical instructor.
  const explanationsBySection = useMemo(() => {
    const map = new Map<string, UnpredictedInstructor[]>();
    if (!course || !schedulesData || termId == null) return map;
    const grades = courseGrades?.courses.find((c) => c.code === course.courseCode)?.sections ?? [];
    if (grades.length === 0) return map;
    for (const [component, sections] of Object.entries(course.components)) {
      for (const section of sections) {
        const predicted = section.predictedInstructors ?? [];
        if (predicted.length === 0 || knownSectionInstructors(section).length > 0) continue;
        const items = explainUnpredictedInstructors({
          courseCode: course.courseCode,
          section,
          termSchedules: schedulesData.schedules,
          termId,
          courseGrades: grades,
          predicted,
          maxReasons: 6,
        });
        if (items.length > 0) map.set(`${component}\u0000${sectionId(section)}`, items);
      }
    }
    return map;
  }, [course, schedulesData, courseGrades, termId]);

  const courseFallbackViz = useMemo(() => {
    if (!normCode) return null;
    return getCourseEntryByNorm().get(normCode)?.gradeViz ?? null;
  }, [normCode, getCourseEntryByNorm]);

  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelection(course ? defaultSelection(course) : {});
  }, [course]);

  const componentKeys = useMemo(
    () => (course ? Object.keys(course.components).sort() : []),
    [course],
  );

  const getSection = (component: string): ComponentSection | null => {
    if (!course) return null;
    const sections = course.components[component] ?? [];
    const id = selection[component];
    return sections.find((s) => sectionId(s) === id) ?? null;
  };

  const selectedSections = componentKeys
    .map((c) => getSection(c))
    .filter((s): s is ComponentSection => s !== null);

  const hasConflict = useMemo(
    () => sectionsHaveInternalOverlap(selectedSections),
    [selectedSections],
  );

  const previewSchedule = useMemo<GeneratedSchedule | null>(() => {
    if (!course || selectedSections.length === 0) return null;
    const combo: SectionCombo = {};
    for (const component of componentKeys) {
      const section = getSection(component);
      if (section) combo[component] = { section };
    }
    return { enrollments: [getEnrollmentsForCourse(course, combo)] };
    // oxlint-disable-next-line react/exhaustive-deps
  }, [course, componentKeys, selection]);

  const sentiment = useScheduleSentiment();
  const events = useCalendarEvents(previewSchedule, professorRatings, sentiment);
  const colorMap = useMemo(
    () => (previewSchedule ? buildColorMap(previewSchedule) : {}),
    [previewSchedule],
  );
  const showWeekends = events.some((e) => e.day === "Sa" || e.day === "Su");

  const courseTitle = course?.title ?? null;
  const headingCode = course?.courseCode ?? normCode ?? urlCourseParam.toUpperCase();

  // Display code used for the basket (matches the codes added from explore cards).
  const basketCode = useMemo(() => {
    if (course?.courseCode) return course.courseCode;
    if (!normCode) return null;
    return cache?.getCourse(normCode)?.code ?? normCode;
  }, [course, normCode, cache]);

  usePublishBasketTarget(basketCode);

  // How this course fits the student's remaining requirements: which (if any) of
  // their uncovered requirements list it as a candidate. Drives the inline hint.
  const fit = useMemo(() => {
    const hasProgram = remainingRequirements.length > 0;
    if (!normCode) return { hasProgram, matchCount: 0, firstTitle: null as string | null };
    const titles: string[] = [];
    for (const req of remainingRequirements) {
      if ((req.candidateCourses ?? []).some((c) => normalizeCourseCode(c) === normCode)) {
        if (req.title) titles.push(req.title);
        else titles.push("");
      }
    }
    return {
      hasProgram,
      matchCount: titles.length,
      firstTitle: titles.find((t) => t.length > 0) ?? null,
    };
  }, [normCode, remainingRequirements]);

  return (
    <Stack gap={0}>
      <Box
        pt={{ base: 4, md: 0 }}
        pb="md"
        style={{
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
        }}
      >
        <Box mb={8}>
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {headingCode}
          </Title>
        </Box>
        {courseTitle ? (
          <Text size="sm" c="dimmed" lh={1.5} mt={8}>
            {courseTitle}
          </Text>
        ) : null}
        {termId !== null ? (
          <Text size="sm" c="var(--app-text-muted)" fw={600} mt={6}>
            {formatTermLabel(termId)}
          </Text>
        ) : null}
        <CourseFitHint fit={fit} />
      </Box>

      <Box
        style={{
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingBottom: 48,
        }}
      >
        {termId === null ? (
          <Text size="sm" c="dimmed">
            {tr("explore.schedule.selectTerm")}
          </Text>
        ) : loading ? (
          <Group gap="xs" c="dimmed">
            <Loader size="sm" />
            <Text size="sm">{tr("explore.schedule.loading")}</Text>
          </Group>
        ) : !course ? (
          <Stack gap={6}>
            <Text size="sm" c="dimmed">
              {tr("explore.schedule.notOffered")}
            </Text>
            <Link
              to="/explore/course/$course"
              params={{ course: urlCourseParam }}
              search={EMPTY_EXPLORE_SEARCH}
              style={{ color: "var(--app-accent)", fontSize: "var(--mantine-font-size-sm)" }}
            >
              {tr("explore.schedule.viewGrades")}
            </Link>
          </Stack>
        ) : (
          (() => {
            const conflictBanner = hasConflict ? (
              <Group gap={6} wrap="nowrap" c="var(--app-warning)">
                <IconAlertTriangle size={16} stroke={1.7} />
                <Text size="xs" fw={600}>
                  {tr("explore.schedule.conflict")}
                </Text>
              </Group>
            ) : null;

            const PAD = EXPLORE_ACCORDION_PAD_INLINE.xs;
            const renderComponentGroup = (component: string, bleedRight: boolean) => {
              const sections = course.components[component] ?? [];
              // Times of the sections currently picked in the *other* components,
              // used to grey out sections here that would overlap them.
              const otherTimes = collectTimes(
                componentKeys
                  .filter((k) => k !== component)
                  .map((k) => getSection(k))
                  .filter((s): s is ComponentSection => s !== null),
              );
              return (
                <Stack key={component} gap={6}>
                  <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.02em" }}>
                    {component}
                  </Text>
                  {/* Negative inline margins let cards scroll past the page gutter
                      (full-bleed), mirroring the Explore result scrollers. */}
                  <Box
                    style={{
                      overflowX: "auto",
                      overflowY: "hidden",
                      paddingTop: 10,
                      paddingBottom: 12,
                      marginLeft: `calc(-1 * ${PAD})`,
                      paddingLeft: PAD,
                      ...(bleedRight
                        ? { marginRight: `calc(-1 * ${PAD})`, paddingRight: PAD }
                        : {}),
                    }}
                  >
                    <Box style={{ display: "flex", gap: 10, width: "max-content" }}>
                      {sections.map((section) => {
                        const isSelected = selection[component] === sectionId(section);
                        const conflicts =
                          !isSelected &&
                          otherTimes.length > 0 &&
                          collectTimes([section]).some((a) =>
                            otherTimes.some((b) => timesOverlap(a, b)),
                          );
                        return (
                          <Box
                            key={sectionId(section)}
                            style={{
                              position: "relative",
                              width: SECTION_CARD_SIZE,
                              height: SECTION_CARD_SIZE,
                              flexShrink: 0,
                            }}
                          >
                            <SectionOption
                              section={section}
                              courseFallbackViz={courseFallbackViz}
                              selected={isSelected}
                              disabled={conflicts}
                              onSelect={() =>
                                setSelection((prev) => ({
                                  ...prev,
                                  [component]: sectionId(section),
                                }))
                              }
                            />
                            {(() => {
                              const explanations = explanationsBySection.get(
                                `${component}\u0000${sectionId(section)}`,
                              );
                              return explanations && explanations.length > 0 ? (
                                <WhyNotPredictedPopover items={explanations} registry={registry} />
                              ) : null;
                            })()}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Stack>
              );
            };

            const calendar = (
              <WeekCalendar
                events={events}
                cache={null}
                colorMap={colorMap}
                onEventClick={() => {}}
                showWeekends={showWeekends}
                animationPhase="idle"
                activeEventId={null}
                isMobile={isMobile ?? false}
                isFullscreen={false}
                onEventClose={() => {}}
              />
            );

            const buildPickers = (bleedRight: boolean) => (
              <Stack gap="md">
                {conflictBanner}
                {componentKeys.map((component) => renderComponentGroup(component, bleedRight))}
              </Stack>
            );

            // Mobile: calendar on top, pickers stacked below (bleed both edges).
            if (isMobile) {
              return (
                <Stack gap="md">
                  <Box style={{ height: CAL_MOBILE_HEIGHT }}>{calendar}</Box>
                  {buildPickers(true)}
                </Stack>
              );
            }

            // Desktop: pickers in a left column (bleed left only — the calendar
            // bounds the right side).
            return (
              <Flex direction="row" gap="lg" align="flex-start">
                <Box style={{ flex: "0 0 360px", width: 360 }}>{buildPickers(false)}</Box>
                <Box style={{ flex: 1, minWidth: 0, height: CAL_DESKTOP_HEIGHT }}>{calendar}</Box>
              </Flex>
            );
          })()
        )}
      </Box>
    </Stack>
  );
}

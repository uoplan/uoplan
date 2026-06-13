import { useMemo, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Pill,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import {
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
  IconShoppingCart,
  IconTrash,
} from "@tabler/icons-react";
import type { DataCache } from "@uoplan/core";
import { getCourseCredits } from "@uoplan/core";
import { useBasketSelection } from "../../hooks/useBasket";
import { tr, useTr } from "../../i18n";
import { useBasketResolution } from "../../lib/generation/useBasketResolution";
import { computeStillNeeded } from "../../lib/generation/computeStillNeeded";
import type { StillNeededRequirement } from "../../lib/generation/computeStillNeeded";
import type { DesiredCourseResolution } from "../../lib/generation/resolveDesiredCourses";
import { useCompletedCourses, useDataCache, useRequirementState } from "../../store/hooks";
import classes from "./BasketContents.module.css";

interface BasketContentsProps {
  variant?: "popover" | "embedded";
  onNavigate?: () => void;
}

type StatusKind = "assigned" | "standalone" | "warning" | "muted";

interface CourseStatus {
  label: string;
  kind: StatusKind;
}

type StandaloneResolutionKey = Exclude<keyof DesiredCourseResolution, "assigned">;

// Categories for the breakdown panel. `standalone` is intentionally omitted: the
// resolver makes it the union of prereqUnmet/overflow/noRequirement, so listing it
// too would show every standalone course twice.
const STATUS_ORDER: StandaloneResolutionKey[] = [
  "completed",
  "unavailable",
  "prereqUnmet",
  "overflow",
  "noRequirement",
];

const I18N = {
  credits: "basket.credits",
  title: "basket.title",
  summaryProgramHint: "basket.summary.programHint",
  summaryNoProgramHint: "basket.summary.noProgramHint",
  statCreditsPlaced: "basket.stat.creditsPlaced",
  statRequirementsCovered: "basket.stat.requirementsCovered",
  statRequirementsRemaining: "basket.stat.requirementsRemaining",
  statCourseCount: "basket.stat.courseCount",
  noProgramCopy: "basket.noProgram.copy",
  noProgramLink: "basket.noProgram.link",
  emptyTitle: "basket.empty.title",
  emptyBody: "basket.empty.body",
  removeCourse: "basket.removeCourse",
  detailsHide: "basket.details.hide",
  detailsShow: "basket.details.show",
  breakdownTitle: "basket.breakdown.title",
  stillNeededTitle: "basket.stillNeeded.title",
  stillNeededEmpty: "basket.stillNeeded.empty",
  stillNeededProgress: "basket.stillNeeded.progress",
  stillNeededNoSuggestions: "basket.stillNeeded.noSuggestions",
  stillNeededUntitled: "basket.stillNeeded.untitled",
  statusAssigned: "basket.status.assigned",
  statusCompleted: "basket.status.completed",
  statusUnavailable: "basket.status.unavailable",
  statusPrereqUnmet: "basket.status.prereqUnmet",
  statusOverflow: "basket.status.overflow",
  statusNoRequirement: "basket.status.noRequirement",
  statusRequired: "basket.status.required",
  statusStandalone: "basket.status.standalone",
  breakdown: {
    assigned: "basket.breakdown.assigned",
    completed: "basket.breakdown.completed",
    unavailable: "basket.breakdown.unavailable",
    prereqUnmet: "basket.breakdown.prereqUnmet",
    overflow: "basket.breakdown.overflow",
    noRequirement: "basket.breakdown.noRequirement",
    standalone: "basket.breakdown.standalone",
  },
} as const;

function formatCredits(credits: number): string {
  return tr(I18N.credits, { credits });
}

// Beyond this, a requirement's candidate pool is an open-ended set (e.g. "any 3000-level
// course") rather than a fixed list worth spelling out, so untitled ones fall back to a
// generic label instead of dumping dozens of codes.
const MAX_LISTED_REQUIREMENT_COURSES = 12;

/**
 * A human label for a still-needed requirement. Prefers the program's own title; when the
 * data gives the requirement only a synthetic id (e.g. "req-22"), spells out its fixed
 * course pool instead of leaking the id, falling back to a generic label only for pools too
 * large to enumerate.
 */
function requirementDisplayLabel(requirement: StillNeededRequirement): string {
  const title = requirement.title?.trim();
  if (title) return title;
  const { courseList } = requirement;
  if (courseList.length > 0 && courseList.length <= MAX_LISTED_REQUIREMENT_COURSES) {
    return courseList.join(", ");
  }
  return tr(I18N.stillNeededUntitled);
}

function getCourseDisplay(code: string, cache: DataCache | null) {
  if (!cache) return { code, title: null, credits: 0 };
  const canonical = cache.resolveToCanonical(code);
  const course = cache.getCourse(canonical) ?? cache.getCourse(code);
  return {
    code: course?.code ?? code,
    title: course?.title ?? null,
    credits: getCourseCredits(canonical, cache),
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function buildStatus(
  code: string,
  hasProgram: boolean,
  assignmentByCode: Map<string, string>,
  resolution: DesiredCourseResolution,
): CourseStatus {
  const assignedTitle = assignmentByCode.get(code);
  if (assignedTitle) {
    return {
      label: tr(I18N.statusAssigned, { requirement: assignedTitle }),
      kind: "assigned",
    };
  }
  if (resolution.completed.includes(code)) {
    return { label: tr(I18N.statusCompleted), kind: "muted" };
  }
  if (resolution.unavailable.includes(code)) {
    return { label: tr(I18N.statusUnavailable), kind: "muted" };
  }
  // No program → every basket course is simply force-pinned as required (see
  // handleBasicGeneration). The requirement-relative buckets below
  // (prereqUnmet/overflow/noRequirement) are not meaningful here: with no program
  // there are no requirements and `prereqEligibleCourses` is empty, so every course
  // would otherwise be mislabelled "prereqs not met".
  if (!hasProgram) {
    return { label: tr(I18N.statusRequired), kind: "standalone" };
  }
  if (resolution.prereqUnmet.includes(code)) {
    return { label: tr(I18N.statusPrereqUnmet), kind: "warning" };
  }
  if (resolution.overflow.includes(code)) {
    return { label: tr(I18N.statusOverflow), kind: "warning" };
  }
  if (resolution.noRequirement.includes(code)) {
    return { label: tr(I18N.statusNoRequirement), kind: "muted" };
  }
  return { label: tr(I18N.statusStandalone), kind: "standalone" };
}

function statusDotColor(kind: StatusKind): string {
  switch (kind) {
    case "assigned":
      return "var(--mantine-color-green-6)";
    case "warning":
      return "var(--mantine-color-yellow-6)";
    case "standalone":
      return "var(--mantine-color-blue-6)";
    case "muted":
      return "var(--mantine-color-gray-5)";
  }
}

export function BasketContents({ variant = "popover", onNavigate }: BasketContentsProps) {
  const t = useTr();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { basketCourses, addToBasket, removeFromBasket } = useBasketSelection();
  const { completedCourses } = useCompletedCourses();
  const { constrainedPerRequirement, selectedPerRequirement, prereqEligibleCourses } =
    useRequirementState();
  const cache = useDataCache();
  const { resolution, assignments, effectiveRemainingRequirements, hasProgram } =
    useBasketResolution();

  const stillNeeded = useMemo(
    () =>
      computeStillNeeded({
        remainingRequirements: effectiveRemainingRequirements,
        resolution,
        completedCourses,
        constrainedPerRequirement,
        selectedPerRequirement,
        prereqEligibleCourses,
        basketCourses,
        cache,
        maxSuggestionsPerRequirement: 4,
      }),
    [
      effectiveRemainingRequirements,
      resolution,
      completedCourses,
      constrainedPerRequirement,
      selectedPerRequirement,
      prereqEligibleCourses,
      basketCourses,
      cache,
    ],
  );

  const assignmentByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const assignment of assignments) {
      for (const code of assignment.codes) {
        map.set(code, assignment.requirementTitle);
      }
    }
    return map;
  }, [assignments]);

  const courseDisplays = useMemo(
    () => basketCourses.map((code) => getCourseDisplay(code, cache)),
    [basketCourses, cache],
  );

  const totalCredits = courseDisplays.reduce((sum, course) => sum + course.credits, 0);
  const placedCredits = assignments.reduce(
    (sum, assignment) =>
      sum +
      assignment.codes.reduce((inner, code) => inner + getCourseDisplay(code, cache).credits, 0),
    0,
  );
  const neededCreditGap = stillNeeded.reduce(
    (sum, requirement) => sum + Math.max(0, requirement.creditsNeeded - requirement.creditsCovered),
    0,
  );
  const targetCredits = placedCredits + neededCreditGap;
  const coveredRequirements = assignments.length;
  const remainingRequirements = stillNeeded.length;
  // A partially-covered requirement appears in BOTH `assignments` (has ≥1 assigned
  // course) and `stillNeeded` (still has a credit gap), so summing the two lengths
  // double-counts it. Count the distinct tracked requirement ids instead.
  const trackedRequirementIds = new Set<string>();
  for (const assignment of assignments) trackedRequirementIds.add(assignment.requirementId);
  for (const requirement of stillNeeded) trackedRequirementIds.add(requirement.requirementId);
  const totalTrackedRequirements = trackedRequirementIds.size;
  const progressPercent = hasProgram
    ? clampPercent(targetCredits > 0 ? (placedCredits / targetCredits) * 100 : 0)
    : basketCourses.length > 0
      ? 100
      : 0;

  const categorized = useMemo(
    () => [
      {
        id: "assigned",
        title: t(I18N.breakdown.assigned),
        codes: assignments.flatMap((assignment) => assignment.codes),
      },
      ...STATUS_ORDER.map((key) => ({
        id: key,
        title: t(I18N.breakdown[key]),
        codes: resolution[key],
      })),
    ],
    [assignments, resolution, t],
  );

  if (basketCourses.length === 0) {
    return (
      <Stack
        gap="sm"
        className={`${classes.shell} ${variant === "embedded" ? classes.embedded : ""}`}
      >
        <Box className={classes.emptyState}>
          <ThemeIcon variant="light" color="blue" radius="xl" size="lg" mb="sm">
            <IconShoppingCart size={18} aria-hidden />
          </ThemeIcon>
          <Text fw={700}>{t(I18N.emptyTitle)}</Text>
          <Text size="sm" c="dimmed" mt={4}>
            {t(I18N.emptyBody)}
          </Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack
      gap="sm"
      className={`${classes.shell} ${variant === "embedded" ? classes.embedded : ""}`}
    >
      <Stack gap={8} className={classes.header}>
        <div>
          <Text fw={700} size="sm" lh={1.2}>
            {t(I18N.title)}
          </Text>
          <Text size="xs" c="dimmed" lh={1.3} mt={2}>
            {hasProgram ? t(I18N.summaryProgramHint) : t(I18N.summaryNoProgramHint)}
          </Text>
        </div>
        <Box className={classes.statTrack} aria-hidden>
          <Box
            className={classes.statFill}
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </Box>
        <Group gap={6} wrap="wrap">
          {hasProgram ? (
            <>
              <Badge variant="light" color="blue">
                {t(I18N.statCreditsPlaced, { placed: placedCredits, target: targetCredits })}
              </Badge>
              <Badge variant="light" color="green">
                {t(I18N.statRequirementsCovered, {
                  covered: coveredRequirements,
                  total: totalTrackedRequirements,
                })}
              </Badge>
              {remainingRequirements > 0 ? (
                <Badge variant="outline" color="gray">
                  {t(I18N.statRequirementsRemaining, { count: remainingRequirements })}
                </Badge>
              ) : null}
            </>
          ) : (
            <>
              <Badge variant="light" color="blue">
                {t(I18N.statCourseCount, { count: basketCourses.length })}
              </Badge>
              <Badge variant="light" color="green">
                {formatCredits(totalCredits)}
              </Badge>
            </>
          )}
        </Group>
        {!hasProgram ? (
          <Text size="xs" c="dimmed" lh={1.35}>
            {t(I18N.noProgramCopy)}{" "}
            <Anchor component={Link} to="/personalize" onClick={onNavigate} size="xs" fw={600}>
              {t(I18N.noProgramLink)}
            </Anchor>
          </Text>
        ) : null}
      </Stack>

      <div className={classes.courseList}>
        {courseDisplays.map((course) => {
          const status = buildStatus(course.code, hasProgram, assignmentByCode, resolution);
          return (
            <Group
              key={course.code}
              className={classes.courseRow}
              wrap="nowrap"
              align="center"
              gap={10}
            >
              <Box
                className={classes.statusDot}
                style={{ background: statusDotColor(status.kind) }}
                aria-hidden
              />
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} wrap="nowrap" align="baseline">
                  <Text fw={700} size="sm" lh={1.2}>
                    {course.code}
                  </Text>
                  {course.credits > 0 ? (
                    <Text size="xs" c="dimmed" lh={1}>
                      {formatCredits(course.credits)}
                    </Text>
                  ) : null}
                </Group>
                <Text size="xs" c="dimmed" lh={1.3} truncate title={course.title ?? status.label}>
                  {course.title ? `${course.title} · ${status.label}` : status.label}
                </Text>
              </Box>
              <ActionIcon
                className={classes.removeButton}
                variant="subtle"
                color="gray"
                radius="xl"
                size="sm"
                aria-label={t(I18N.removeCourse, { code: course.code })}
                onClick={() => removeFromBasket(course.code)}
              >
                <IconTrash size={15} aria-hidden />
              </ActionIcon>
            </Group>
          );
        })}
      </div>

      {hasProgram ? (
        <>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            radius="md"
            rightSection={detailsOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? t(I18N.detailsHide) : t(I18N.detailsShow)}
          </Button>

          <Collapse expanded={detailsOpen}>
            <Stack gap="sm" className={classes.detailPanel}>
              <Stack gap="xs">
                <Group gap={6} wrap="nowrap">
                  <IconInfoCircle size={16} color="var(--app-text-muted)" aria-hidden />
                  <Text fw={800} size="sm">
                    {t(I18N.breakdownTitle)}
                  </Text>
                </Group>
                <Stack gap="xs">
                  {categorized
                    .filter((category) => category.codes.length > 0)
                    .map((category) => (
                      <Stack key={category.id} gap={5} className={classes.categoryBlock}>
                        <Text size="xs" fw={700} c="dimmed">
                          {category.title}
                        </Text>
                        <Group gap={5} wrap="wrap">
                          {category.codes.map((code) => (
                            <Pill key={`${category.id}-${code}`} size="sm">
                              {code}
                            </Pill>
                          ))}
                        </Group>
                      </Stack>
                    ))}
                </Stack>
              </Stack>

              <Stack gap="xs">
                <Text fw={800} size="sm">
                  {t(I18N.stillNeededTitle)}
                </Text>
                {stillNeeded.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    {t(I18N.stillNeededEmpty)}
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {stillNeeded.map((requirement) => {
                      const label = requirementDisplayLabel(requirement);
                      return (
                        <Stack key={requirement.requirementId} gap={5}>
                          <Group justify="space-between" gap="sm" wrap="nowrap">
                            <Text size="xs" fw={700} style={{ minWidth: 0 }} truncate title={label}>
                              {label}
                            </Text>
                            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                              {t(I18N.stillNeededProgress, {
                                covered: requirement.creditsCovered,
                                needed: requirement.creditsNeeded,
                              })}
                            </Text>
                          </Group>
                          {requirement.suggestions.length > 0 ? (
                            <Group gap={5} wrap="wrap">
                              {requirement.suggestions.map((code) => (
                                <Button
                                  key={`${requirement.requirementId}-${code}`}
                                  size="compact-xs"
                                  variant="outline"
                                  radius="xl"
                                  className={classes.suggestionButton}
                                  onClick={() => addToBasket(code)}
                                >
                                  {code}
                                </Button>
                              ))}
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">
                              {t(I18N.stillNeededNoSuggestions)}
                            </Text>
                          )}
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Collapse>
        </>
      ) : null}
    </Stack>
  );
}

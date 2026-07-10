import { useId, useMemo, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Pill,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import {
  IconAward,
  IconBooks,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleDashed,
  IconInfoCircle,
  IconListCheck,
  IconSearch,
  IconTelescope,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { DataCache, DesiredCourseResolution, StillNeededRequirement } from "@uoplan/core";
import { computeStillNeeded, getCourseCredits, normalizeCourseCode } from "@uoplan/core";
import { useBasketSelection } from "../../hooks/useBasket";
import { tr, useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { useBasketResolution } from "../../lib/generation/useBasketResolution";
import {
  useCompletedCourses,
  useDataCache,
  useRequirementState,
  useTermSelection,
} from "@uoplan/store/hooks";
import { useCourseSelectOptions } from "../shared/useCourseSelectOptions";
import classes from "./BasketContents.module.css";

interface BasketContentsProps {
  variant?: "popover" | "embedded";
  onNavigate?: () => void;
  /** Show the inline "courses you want" add-search field. Defaults to the embedded (sidebar) card. */
  showCourseField?: boolean;
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
  statCreditsPlacedTip: "basket.stat.creditsPlaced.tip",
  statRequirementsCoveredTip: "basket.stat.requirementsCovered.tip",
  statRequirementsRemainingTip: "basket.stat.requirementsRemaining.tip",
  statCourseCountTip: "basket.stat.courseCount.tip",
  statCreditsTip: "basket.stat.credits.tip",
  noProgramCopy: "basket.noProgram.copy",
  noProgramLink: "basket.noProgram.link",
  emptyTitle: "basket.empty.title",
  emptyBody: "basket.empty.body",
  emptyCta: "basket.empty.cta",
  removeCourse: "basket.removeCourse",
  viewCourse: "basket.viewCourse",
  coursesPlaceholder: "basket.addCourse.placeholder",
  coursesNotFound: "completedCourses.notFound",
  removePrompt: "basket.removePrompt",
  confirmRemove: "basket.confirmRemove",
  cancelRemove: "basket.cancelRemove",
  summaryCollapse: "basket.summary.collapse",
  summaryExpand: "basket.summary.expand",
  detailsHide: "basket.details.hide",
  detailsShow: "basket.details.show",
  breakdownTitle: "basket.breakdown.title",
  stillNeededTitle: "basket.stillNeeded.title",
  stillNeededEmpty: "basket.stillNeeded.empty",
  stillNeededProgress: "basket.stillNeeded.progress",
  stillNeededNoSuggestions: "basket.stillNeeded.noSuggestions",
  stillNeededMore: "basket.stillNeeded.moreCourses",
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

export function BasketContents({
  variant = "popover",
  onNavigate,
  showCourseField = variant === "embedded",
}: BasketContentsProps) {
  const t = useTr();
  const bodyId = useId();
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const { basketCourses, addToBasket, removeFromBasket } = useBasketSelection();
  const analytics = useAnalytics();
  const { desiredCourseOptions, courseOptionsFilter, courseRenderOption } =
    useCourseSelectOptions();
  const { completedCourses } = useCompletedCourses();
  const { constrainedPerRequirement, selectedPerRequirement, prereqEligibleCourses } =
    useRequirementState();
  const cache = useDataCache();
  const { selectedTermId } = useTermSelection();
  const { resolution, assignments, effectiveRemainingRequirements, hasProgram } =
    useBasketResolution();

  const exploreSearch = useMemo(
    () => ({
      ...EMPTY_EXPLORE_SEARCH,
      term: selectedTermId ? Number(selectedTermId) : undefined,
      reqs: hasProgram ? "1" : undefined,
    }),
    [selectedTermId, hasProgram],
  );

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

  // The add-search only offers courses not already in the basket, so picking one always adds.
  const addableCourseOptions = useMemo(() => {
    if (basketCourses.length === 0) return desiredCourseOptions;
    const inBasket = new Set(basketCourses.map((code) => normalizeCourseCode(code)));
    return desiredCourseOptions.filter((o) => !inBasket.has(normalizeCourseCode(o.value)));
  }, [desiredCourseOptions, basketCourses]);

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

  return (
    <Stack
      gap={variant === "embedded" ? 0 : "sm"}
      className={`${classes.shell} ${variant === "embedded" ? classes.embedded : ""}`}
    >
      <UnstyledButton
        className={`${classes.header} ${classes.summaryToggle}`}
        onClick={() => setSummaryOpen((open) => !open)}
        aria-expanded={summaryOpen}
        aria-controls={bodyId}
        aria-label={t(summaryOpen ? I18N.summaryCollapse : I18N.summaryExpand)}
      >
        <Stack gap={8}>
          <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
            <Text fw={700} size="sm" lh={1.2}>
              {t(I18N.title)}
            </Text>
            <Box className={classes.summaryChevron} aria-hidden>
              {summaryOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </Box>
          </Group>
          <Group gap={6} wrap="wrap">
            {hasProgram ? (
              <>
                <Tooltip label={t(I18N.statCreditsPlacedTip)} withArrow>
                  <Badge
                    variant="light"
                    color="gray"
                    leftSection={<IconAward size={12} aria-hidden />}
                    aria-label={`${t(I18N.statCreditsPlacedTip)}: ${placedCredits}/${targetCredits}`}
                  >
                    {placedCredits}/{targetCredits}
                  </Badge>
                </Tooltip>
                <Tooltip label={t(I18N.statRequirementsCoveredTip)} withArrow>
                  <Badge
                    variant="light"
                    color="gray"
                    leftSection={<IconListCheck size={12} aria-hidden />}
                    aria-label={`${t(I18N.statRequirementsCoveredTip)}: ${coveredRequirements}/${totalTrackedRequirements}`}
                  >
                    {coveredRequirements}/{totalTrackedRequirements}
                  </Badge>
                </Tooltip>
                {remainingRequirements > 0 ? (
                  <Tooltip label={t(I18N.statRequirementsRemainingTip)} withArrow>
                    <Badge
                      variant="outline"
                      color="gray"
                      leftSection={<IconCircleDashed size={12} aria-hidden />}
                      aria-label={`${t(I18N.statRequirementsRemainingTip)}: ${remainingRequirements}`}
                    >
                      {remainingRequirements}
                    </Badge>
                  </Tooltip>
                ) : null}
              </>
            ) : (
              <>
                <Tooltip label={t(I18N.statCourseCountTip)} withArrow>
                  <Badge
                    variant="light"
                    color="gray"
                    leftSection={<IconBooks size={12} aria-hidden />}
                    aria-label={`${t(I18N.statCourseCountTip)}: ${basketCourses.length}`}
                  >
                    {basketCourses.length}
                  </Badge>
                </Tooltip>
                <Tooltip label={t(I18N.statCreditsTip)} withArrow>
                  <Badge
                    variant="light"
                    color="gray"
                    leftSection={<IconAward size={12} aria-hidden />}
                    aria-label={`${t(I18N.statCreditsTip)}: ${totalCredits}`}
                  >
                    {totalCredits}
                  </Badge>
                </Tooltip>
              </>
            )}
          </Group>
          <Box className={classes.statTrack} aria-hidden>
            <Box
              className={classes.statFill}
              style={{ transform: `scaleX(${progressPercent / 100})` }}
            />
          </Box>
        </Stack>
      </UnstyledButton>

      {showCourseField ? (
        <Box className={classes.courseField}>
          <Select
            aria-label={t(I18N.coursesPlaceholder)}
            placeholder={t(I18N.coursesPlaceholder)}
            leftSection={<IconSearch size={15} />}
            searchable
            data={addableCourseOptions}
            value={null}
            searchValue={courseSearch}
            onSearchChange={setCourseSearch}
            onChange={(value) => {
              if (!value) return;
              addToBasket(value);
              analytics.capture("basket_course_added", { courseCode: value });
              setCourseSearch("");
            }}
            renderOption={courseRenderOption}
            filter={courseOptionsFilter}
            nothingFoundMessage={t(I18N.coursesNotFound)}
            size="sm"
            radius="md"
            comboboxProps={{ withinPortal: true }}
          />
        </Box>
      ) : null}

      <Collapse id={bodyId} expanded={summaryOpen}>
        <Stack gap="sm" className={classes.body}>
          {basketCourses.length === 0 ? (
            <Box className={classes.emptyState}>
              <Text fw={700} size="sm">
                {t(I18N.emptyTitle)}
              </Text>
              <Text size="xs" c="dimmed" lh={1.35}>
                {t(I18N.emptyBody)}
              </Text>
              <Button
                size="xs"
                radius="xl"
                variant="light"
                leftSection={<IconTelescope size={15} />}
                onClick={() => onNavigate?.()}
                renderRoot={(props) => <Link to="/explore" search={exploreSearch} {...props} />}
              >
                {t(I18N.emptyCta)}
              </Button>
            </Box>
          ) : (
            <div className={classes.courseList}>
              {courseDisplays.map((course) => {
                const status = buildStatus(course.code, hasProgram, assignmentByCode, resolution);
                const confirming = pendingRemoval === course.code;
                return (
                  <div key={course.code} className={classes.courseRow}>
                    <Link
                      to="/explore/course/$course"
                      params={{ course: courseNormToPathParam(normalizeCourseCode(course.code)) }}
                      search={exploreSearch}
                      className={classes.courseLink}
                      aria-label={t(I18N.viewCourse, { code: course.code })}
                      onClick={() => onNavigate?.()}
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
                        <Text
                          size="xs"
                          c="dimmed"
                          lh={1.3}
                          truncate
                          title={course.title ?? status.label}
                        >
                          {course.title ? `${course.title} · ${status.label}` : status.label}
                        </Text>
                      </Box>
                    </Link>
                    {confirming ? (
                      <Group gap={4} wrap="nowrap" className={classes.confirmGroup}>
                        <Text size="xs" c="dimmed" fw={600}>
                          {t(I18N.removePrompt)}
                        </Text>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          className={classes.confirmRemove}
                          aria-label={t(I18N.confirmRemove, { code: course.code })}
                          onClick={() => {
                            removeFromBasket(course.code);
                            analytics.capture("basket_course_removed", { courseCode: course.code });
                            setPendingRemoval(null);
                          }}
                        >
                          <IconCheck size={15} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label={t(I18N.cancelRemove)}
                          onClick={() => setPendingRemoval(null)}
                        >
                          <IconX size={15} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        className={classes.removeButton}
                        aria-label={t(I18N.removeCourse, { code: course.code })}
                        onClick={() => setPendingRemoval(course.code)}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!hasProgram && basketCourses.length > 0 ? (
            <Group gap={6} wrap="wrap">
              <Text size="xs" c="dimmed" lh={1.35}>
                {t(I18N.noProgramCopy)}
              </Text>
              <Anchor component={Link} to="/personalize" onClick={onNavigate} size="xs" fw={600}>
                {t(I18N.noProgramLink)}
              </Anchor>
            </Group>
          ) : null}

          {hasProgram ? (
            <>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                radius="md"
                rightSection={
                  detailsOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                }
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
                                <Text
                                  size="xs"
                                  fw={700}
                                  style={{ minWidth: 0 }}
                                  truncate
                                  title={label}
                                >
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
                                <Group gap={5} wrap="wrap" align="center">
                                  {requirement.suggestions.map((code) => (
                                    <Button
                                      key={`${requirement.requirementId}-${code}`}
                                      size="compact-xs"
                                      variant="outline"
                                      radius="xl"
                                      className={classes.suggestionButton}
                                      onClick={() => {
                                        addToBasket(code);
                                        analytics.capture("basket_course_added", {
                                          courseCode: code,
                                        });
                                      }}
                                    >
                                      {code}
                                    </Button>
                                  ))}
                                  {requirement.suggestionPoolSize >
                                  requirement.suggestions.length ? (
                                    <Badge
                                      variant="default"
                                      radius="xl"
                                      className={classes.morePill}
                                    >
                                      {t(I18N.stillNeededMore, {
                                        count:
                                          requirement.suggestionPoolSize -
                                          requirement.suggestions.length,
                                      })}
                                    </Badge>
                                  ) : null}
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
      </Collapse>
    </Stack>
  );
}

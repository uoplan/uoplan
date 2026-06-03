import { ActionIcon, Box, Group, Stack, Text } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import type { DataCache, GeneratedSchedule, ProfessorRatingsMap } from "@uoplan/core";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { EventStyleCard } from "./EventStyleCard";
import { GradeDistributionExpanded } from "./GradeDistributionViz";
import { SwapCourseDropdown } from "./SwapCourseDropdown";
import {
  isCourseInPerRequirementMaps,
  resolveRequirementIdsForScheduleCourse,
} from "../../lib/requirements/requirementUtils";
import { useAppStore } from "../../store/appStore";
import { ActionIcon as MantineActionIcon, Tooltip } from "@mantine/core";
import { IconBan, IconLock, IconLockFilled } from "@tabler/icons-react";
import { normalizeCourseCode } from "@uoplan/core";
import { useMemo } from "react";
import { tr } from "../../i18n";
import { CALENDAR_HEADER_MIN_HEIGHT } from "./calendarHeaderLayout";

export function SwapPanel({
  schedule,
  modalState,
  result,
  loading,
  candidateOptions,
  query,
  setQuery,
  closeModal,
  cache,
  professorRatings,
  onSwap,
}: {
  schedule: GeneratedSchedule | null;
  modalState: SwapModalState;
  result: SwapResult;
  loading: boolean;
  candidateOptions: SwapCandidateOption[];
  query: string;
  setQuery: (q: string) => void;
  closeModal: () => void;
  cache: DataCache | null;
  professorRatings: ProfessorRatingsMap | null;
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
}) {
  const enrollment = schedule?.enrollments[modalState.enrollmentIndex];

  const lockCourseForAllSchedulesFromSwap = useAppStore((s) => s.lockCourseForAllSchedulesFromSwap);
  const unlockCourseForAllSchedulesFromSwap = useAppStore(
    (s) => s.unlockCourseForAllSchedulesFromSwap,
  );
  const blacklistCourseFromSwap = useAppStore((s) => s.blacklistCourseFromSwap);
  const unblacklistCourseFromSwap = useAppStore((s) => s.unblacklistCourseFromSwap);
  const blacklistedCourses = useAppStore((s) => s.blacklistedCourses);
  const basicPinnedCourses = useAppStore((s) => s.basicPinnedCourses);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const currentPoolMap = useAppStore((s) => s.currentPoolMap);
  const chosenCourseToRequirementId = useAppStore((s) => s.chosenCourseToRequirementId);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const calendarMode = useAppStore((s) => s.calendarMode);

  const isBasic = calendarMode === "basic";
  const isAdvanced = calendarMode === "advanced";

  const courseCode = modalState.courseCode;
  const courseNorm = normalizeCourseCode(courseCode);
  const courseTitle = cache?.getCourse(courseNorm)?.title;

  const treeRequirementIdsForCourse = useMemo(() => {
    if (!isAdvanced) return [];
    return resolveRequirementIdsForScheduleCourse({
      courseCode,
      courseNorm,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
      currentPoolMap,
      chosenCourseToRequirementId,
      remainingRequirements,
    });
  }, [
    chosenCourseToRequirementId,
    courseCode,
    courseNorm,
    currentPoolMap,
    isAdvanced,
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
  ]);

  const isGenerationPinned = useMemo(() => {
    if (isBasic) return basicPinnedCourses.some((c) => normalizeCourseCode(c) === courseNorm);
    if (isAdvanced) return isCourseInPerRequirementMaps(courseNorm, constrainedPerRequirement);
    return false;
  }, [basicPinnedCourses, constrainedPerRequirement, courseNorm, isAdvanced, isBasic]);

  const isInAssignSelections = useMemo(() => {
    if (!isAdvanced) return false;
    return isCourseInPerRequirementMaps(courseNorm, selectedPerRequirement);
  }, [courseNorm, isAdvanced, selectedPerRequirement]);

  const showLockedIcon = isGenerationPinned || isInAssignSelections;
  const lockUnavailable =
    isAdvanced &&
    !isGenerationPinned &&
    !isInAssignSelections &&
    treeRequirementIdsForCourse.length === 0;

  const isBlacklisted = useMemo(
    () => blacklistedCourses.some((c) => normalizeCourseCode(c) === courseNorm),
    [blacklistedCourses, courseNorm],
  );

  const canLock =
    calendarMode !== null &&
    !isGenerationPinned &&
    !isInAssignSelections &&
    !lockUnavailable &&
    !isBlacklisted;
  const canUnlock = isGenerationPinned;
  const lockControlDisabled = !canLock && !canUnlock;

  const canBlacklist =
    calendarMode !== null && !isGenerationPinned && !isInAssignSelections && !isBlacklisted;
  const canUnblacklist = isBlacklisted;
  const blacklistControlDisabled = !canBlacklist && !canUnblacklist;

  const blacklistTooltip =
    isGenerationPinned || isInAssignSelections
      ? tr("calendar.swap.alreadyLocked")
      : canUnblacklist
        ? tr("calendar.swap.unblacklistTooltip")
        : tr("calendar.swap.blacklistTooltip");

  const lockTooltip = lockUnavailable
    ? tr("calendar.swap.lockNoPool")
    : canUnlock
      ? tr("calendar.swap.unlockTooltip")
      : isInAssignSelections
        ? tr("calendar.swap.alreadyAssigned")
        : tr("calendar.swap.lockTooltip");

  const handleBlacklistToggle = () => {
    if (canUnblacklist) {
      unblacklistCourseFromSwap(modalState.enrollmentIndex);
      closeModal();
      return;
    }
    if (!canBlacklist) return;
    blacklistCourseFromSwap(modalState.enrollmentIndex);
    closeModal();
  };

  const handleLockToggle = () => {
    if (canUnlock) {
      unlockCourseForAllSchedulesFromSwap(modalState.enrollmentIndex);
      closeModal();
      return;
    }
    if (!canLock) return;
    lockCourseForAllSchedulesFromSwap(modalState.enrollmentIndex);
    closeModal();
  };

  return (
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: "var(--app-bg)",
      }}
    >
      {/* Sticky header */}
      <Box
        style={{
          flexShrink: 0,
          minHeight: CALENDAR_HEADER_MIN_HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderBottom: "1px solid var(--app-border)",
          backgroundColor: "var(--app-surface)",
          padding: "8px 12px",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={closeModal}
              aria-label="Back to calendar"
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} style={{ lineHeight: 1.2 }} truncate>
                {courseCode}
                {courseTitle && (
                  <Text span c="dimmed" fw={400}>
                    {" "}
                    — {courseTitle}
                  </Text>
                )}
              </Text>
              {result.requirementTitle && (
                <Text size="xs" c="dimmed" truncate style={{ lineHeight: 1.2 }}>
                  {result.requirementTitle}
                </Text>
              )}
            </div>
          </Group>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={blacklistTooltip} position="left" withArrow>
              <Box component="span" style={{ display: "inline-flex" }}>
                <MantineActionIcon
                  variant="subtle"
                  color={isBlacklisted ? "red" : "gray"}
                  size="sm"
                  disabled={blacklistControlDisabled}
                  aria-label={
                    canUnblacklist
                      ? tr("calendar.swap.unblacklistAria")
                      : tr("calendar.swap.blacklistAria")
                  }
                  onClick={handleBlacklistToggle}
                >
                  <IconBan size={16} stroke={1.5} />
                </MantineActionIcon>
              </Box>
            </Tooltip>
            <Tooltip label={lockTooltip} position="left" withArrow>
              <Box component="span" style={{ display: "inline-flex" }}>
                <MantineActionIcon
                  variant="subtle"
                  color={showLockedIcon ? "yellow" : "gray"}
                  size="sm"
                  disabled={lockControlDisabled}
                  aria-label={
                    canUnlock ? tr("calendar.swap.unlockAria") : tr("calendar.swap.lockAria")
                  }
                  onClick={handleLockToggle}
                >
                  {showLockedIcon ? (
                    <IconLockFilled size={16} stroke={1.5} />
                  ) : (
                    <IconLock size={16} stroke={1.5} />
                  )}
                </MantineActionIcon>
              </Box>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* Scrollable body */}
      <Box style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <Stack gap={0}>
          {/* Current course card */}
          {enrollment && (
            <Box p="sm" style={{ borderBottom: "1px solid var(--app-border)" }}>
              <EventStyleCard
                enrollment={enrollment}
                enrollmentIndex={modalState.enrollmentIndex}
                cache={cache}
                professorRatings={professorRatings}
                componentSection={modalState.componentSection}
                virtual={modalState.virtual}
              />
            </Box>
          )}

          {/* Grade distribution */}
          {modalState.gradeViz && (
            <Box px="sm" pt="sm" style={{ borderBottom: "1px solid var(--app-border)" }}>
              <Text size="xs" c="dimmed" fw={600} mb={6}>
                {tr("calendar.grade.distribution")}
              </Text>
              <GradeDistributionExpanded gradeViz={modalState.gradeViz} />
            </Box>
          )}

          {/* Swap candidates */}
          <Box p="sm">
            <Text size="xs" c="dimmed" fw={600} mb={8}>
              Swap with
            </Text>
            <SwapCourseDropdown
              modalState={modalState}
              loading={loading}
              result={result}
              candidateOptions={candidateOptions}
              query={query}
              setQuery={setQuery}
              closeModal={closeModal}
              onSwap={onSwap}
              inline
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

import { useMemo } from "react";
import { ActionIcon, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconLock, IconLockFilled } from "@tabler/icons-react";
import { normalizeCourseCode } from "schedule";
import type { DataCache, GeneratedSchedule, ProfessorRatingsMap } from "schedule";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { tr } from "../../i18n";
import {
  isCourseInPerRequirementMaps,
  resolveRequirementIdsForScheduleCourse,
} from "../requirements/requirementUtils";
import { useAppStore } from "../../store/appStore";
import {
  isAdvancedPlannerActive,
  isBasicPlannerActive,
  isPlannerVariantActive,
} from "../../lib/calendarRoute";
import { EventStyleCard } from "./EventStyleCard";
import { GradeDistributionExpanded } from "./GradeDistributionViz";
import { SwapCourseDropdown } from "./SwapCourseDropdown";

export function SwapModalContent({
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
  const basicPinnedCourses = useAppStore((s) => s.basicPinnedCourses);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const currentPoolMap = useAppStore((s) => s.currentPoolMap);
  const chosenCourseToRequirementId = useAppStore((s) => s.chosenCourseToRequirementId);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);

  const isBasic = isBasicPlannerActive();
  const isAdvanced = isAdvancedPlannerActive();

  const courseCode = modalState.courseCode;
  const courseNorm = normalizeCourseCode(courseCode);

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
    if (isBasic) {
      return basicPinnedCourses.some((c) => normalizeCourseCode(c) === courseNorm);
    }
    if (isAdvanced) {
      return isCourseInPerRequirementMaps(courseNorm, constrainedPerRequirement);
    }
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

  const canLock =
    isPlannerVariantActive() && !isGenerationPinned && !isInAssignSelections && !lockUnavailable;
  const canUnlock = isGenerationPinned;

  const lockControlDisabled = !canLock && !canUnlock;

  const lockTooltip = lockUnavailable
    ? tr("calendar.swap.lockNoPool")
    : canUnlock
      ? tr("calendar.swap.unlockTooltip")
      : isInAssignSelections
        ? tr("calendar.swap.alreadyAssigned")
        : tr("calendar.swap.lockTooltip");

  const lockAria = canUnlock ? tr("calendar.swap.unlockAria") : tr("calendar.swap.lockAria");

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
    <Stack gap="md" mt="md">
      {result.requirementTitle && (
        <Box
          px="sm"
          py="sm"
          style={{
            backgroundColor: "var(--mantine-color-dark-6)",
          }}
        >
          <Text
            size="xs"
            c="dimmed"
            tt="uppercase"
            fw={600}
            mb={6}
            style={{ letterSpacing: "0.05em" }}
          >
            Satisfying requirement
          </Text>
          <Text size="sm" lh={1.45} style={{ color: "var(--mantine-color-gray-3)" }}>
            {result.requirementTitle}
          </Text>
        </Box>
      )}

      <div>
        <Group justify="space-between" align="center" mb={6} wrap="nowrap">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Current course
          </Text>
          <Tooltip label={lockTooltip} position="left" withArrow color="dark">
            <Box component="span" style={{ display: "inline-flex" }}>
              <ActionIcon
                variant="subtle"
                color={showLockedIcon ? "yellow" : "gray"}
                size="lg"
                radius="md"
                disabled={lockControlDisabled}
                aria-label={lockAria}
                onClick={handleLockToggle}
              >
                {showLockedIcon ? (
                  <IconLockFilled size={20} stroke={1.5} />
                ) : (
                  <IconLock size={20} stroke={1.5} />
                )}
              </ActionIcon>
            </Box>
          </Tooltip>
        </Group>
        {enrollment ? (
          <EventStyleCard
            enrollment={enrollment}
            enrollmentIndex={modalState.enrollmentIndex}
            cache={cache}
            professorRatings={professorRatings}
            componentSection={modalState.componentSection}
            virtual={modalState.virtual}
          />
        ) : (
          <Text size="sm" c="dimmed">
            {modalState.courseCode}
          </Text>
        )}
      </div>

      {modalState.gradeViz && (
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={6}>
            {tr("calendar.grade.distribution")}
          </Text>
          <GradeDistributionExpanded gradeViz={modalState.gradeViz} />
        </div>
      )}

      <div>
        <Text size="sm" c="dimmed" mb="xs">
          Choose a course to replace it:
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
        />
      </div>
    </Stack>
  );
}

import { useMemo } from "react";
import { ActionIcon, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconLock, IconLockFilled } from "@tabler/icons-react";
import { normalizeCourseCode } from "schedule";
import type { DataCache, GeneratedSchedule, ProfessorRatingsMap } from "schedule";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { tr } from "../../i18n";
import {
  applyOptionSelections,
  collectRequirementIdsWithCandidateCourse,
} from "../requirements/requirementUtils";
import { useAppStore } from "../../store/appStore";
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
  const wizardMode = useAppStore((s) => s.wizardMode);
  const basicPinnedCourses = useAppStore((s) => s.basicPinnedCourses);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const currentPoolMap = useAppStore((s) => s.currentPoolMap);
  const chosenCourseToRequirementId = useAppStore((s) => s.chosenCourseToRequirementId);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);

  const courseCode = modalState.courseCode;
  const courseNorm = normalizeCourseCode(courseCode);

  const poolId = useMemo(() => {
    const id = currentPoolMap[courseCode] ?? chosenCourseToRequirementId[courseCode] ?? undefined;
    if (id) return id;
    for (const req of remainingRequirements) {
      if (!req.requirementId || !req.candidateCourses?.length) continue;
      if (req.candidateCourses.some((c) => normalizeCourseCode(c) === courseNorm)) {
        return req.requirementId;
      }
    }
    return undefined;
  }, [chosenCourseToRequirementId, courseCode, courseNorm, currentPoolMap, remainingRequirements]);

  const treeRequirementIdsForCourse = useMemo(() => {
    if (wizardMode !== "advanced") return [];
    const flat = applyOptionSelections(requirementTreeWithStatus, selectedOptionsPerRequirement);
    return collectRequirementIdsWithCandidateCourse(flat, courseNorm);
  }, [courseNorm, requirementTreeWithStatus, selectedOptionsPerRequirement, wizardMode]);

  const alreadyLocked = useMemo(() => {
    if (wizardMode === "basic") {
      return basicPinnedCourses.some((c) => normalizeCourseCode(c) === courseNorm);
    }
    if (wizardMode === "advanced") {
      for (const codes of Object.values(constrainedPerRequirement)) {
        if (codes.some((c) => normalizeCourseCode(c) === courseNorm)) {
          return true;
        }
      }
    }
    return false;
  }, [basicPinnedCourses, constrainedPerRequirement, courseNorm, wizardMode]);

  const lockUnavailable =
    wizardMode === "advanced" &&
    !alreadyLocked &&
    treeRequirementIdsForCourse.length === 0 &&
    !poolId;

  const lockDisabled = wizardMode == null || alreadyLocked || lockUnavailable;

  const lockTooltip = lockUnavailable
    ? tr("calendar.swap.lockNoPool")
    : alreadyLocked
      ? tr("calendar.swap.alreadyLocked")
      : tr("calendar.swap.lockTooltip");

  const handleLock = () => {
    if (lockDisabled) return;
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
                color={alreadyLocked ? "yellow" : "gray"}
                size="lg"
                radius="md"
                disabled={lockDisabled}
                aria-label={tr("calendar.swap.lockAria")}
                onClick={handleLock}
              >
                {alreadyLocked ? (
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

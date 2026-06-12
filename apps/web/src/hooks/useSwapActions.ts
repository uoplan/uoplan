import { useMemo } from "react";
import { normalizeCourseCode } from "@uoplan/core";
import {
  isCourseInPerRequirementMaps,
  resolveRequirementIdsForScheduleCourse,
} from "../lib/requirements/requirementUtils";
import { useAppStore } from "../store/appStore";
import { tr } from "../i18n";

interface SwapActions {
  showLockedIcon: boolean;
  isBlacklisted: boolean;
  lockControlDisabled: boolean;
  blacklistControlDisabled: boolean;
  canUnlock: boolean;
  canUnblacklist: boolean;
  lockTooltip: string;
  blacklistTooltip: string;
  lockAria: string;
  blacklistAria: string;
  handleLockToggle: () => void;
  handleBlacklistToggle: () => void;
}

/**
 * Encapsulates the lock (pin for all schedules) and blacklist (exclude) actions
 * for a single course in the swap overlay, including eligibility, tooltips and
 * toggle handlers. Lifted out of the former SwapPanel so both the desktop
 * popover and the mobile drawer can reuse it.
 */
export function useSwapActions({
  courseCode,
  enrollmentIndex,
  closeModal,
}: {
  courseCode: string;
  enrollmentIndex: number;
  closeModal: () => void;
}): SwapActions {
  const lockCourseForAllSchedulesFromSwap = useAppStore((s) => s.lockCourseForAllSchedulesFromSwap);
  const unlockCourseForAllSchedulesFromSwap = useAppStore(
    (s) => s.unlockCourseForAllSchedulesFromSwap,
  );
  const blacklistCourseFromSwap = useAppStore((s) => s.blacklistCourseFromSwap);
  const unblacklistCourseFromSwap = useAppStore((s) => s.unblacklistCourseFromSwap);
  const blacklistedCourses = useAppStore((s) => s.blacklistedCourses);
  const basketCourses = useAppStore((s) => s.basketCourses);
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
    if (isBasic) return basketCourses.some((c) => normalizeCourseCode(c) === courseNorm);
    if (isAdvanced) return isCourseInPerRequirementMaps(courseNorm, constrainedPerRequirement);
    return false;
  }, [basketCourses, constrainedPerRequirement, courseNorm, isAdvanced, isBasic]);

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
      unblacklistCourseFromSwap(enrollmentIndex);
      closeModal();
      return;
    }
    if (!canBlacklist) return;
    blacklistCourseFromSwap(enrollmentIndex);
    closeModal();
  };

  const handleLockToggle = () => {
    if (canUnlock) {
      unlockCourseForAllSchedulesFromSwap(enrollmentIndex);
      closeModal();
      return;
    }
    if (!canLock) return;
    lockCourseForAllSchedulesFromSwap(enrollmentIndex);
    closeModal();
  };

  return {
    showLockedIcon,
    isBlacklisted,
    lockControlDisabled,
    blacklistControlDisabled,
    canUnlock,
    canUnblacklist,
    lockTooltip,
    blacklistTooltip,
    lockAria: canUnlock ? tr("calendar.swap.unlockAria") : tr("calendar.swap.lockAria"),
    blacklistAria: canUnblacklist
      ? tr("calendar.swap.unblacklistAria")
      : tr("calendar.swap.blacklistAria"),
    handleLockToggle,
    handleBlacklistToggle,
  };
}

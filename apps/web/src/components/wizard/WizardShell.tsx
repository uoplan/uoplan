import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { Box, Button, Group, Modal, Stack, Text, Title, Tooltip } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "@mantine/hooks";
import { IconCompass, IconHelp, IconRefresh, IconShare } from "@tabler/icons-react";
import { runTour } from "../../tour";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { STEPS, StepNav } from "../shared/StepNav";
import { ResetModal } from "../shared/ResetModal";
import { hasMissingOptionSelections, nodeHasOptionGroups } from "../requirements/requirementUtils";
import {
  ALL_WIZARD_STEP_INDICES,
  buildVisibleStepIndices,
  canAdvanceWizardStep,
  furthestReachedDisplayIndex,
  getNextStep,
  getPrevStep,
  maxReachableWizardStep,
  normalizeActiveStep,
  WizardStep,
} from "../../lib/wizardSteps";
import { navigateToCalendar, navigateToWizardStep } from "../../lib/appNavigation";
import { applyBasicDefaultsIfUntouched, enterAdvancedWizardFlow } from "../../lib/plannerModeFlow";
import { useShareUrl } from "../../hooks/useShareUrl";
import { getWizardStepContent } from "../../lib/wizardStepContent";
import { tr } from "../../i18n";

export type WizardShellProps = {
  activeStep: WizardStep;
  children: ReactNode;
  /** Selected planner mode on the mode step; Next stays disabled until set. */
  modeSelection?: "basic" | "advanced" | null;
};

export function WizardShell({
  activeStep: active,
  children,
  modeSelection = null,
}: WizardShellProps) {
  useLingui();

  const {
    indices,
    cache,
    terms,
    selectedTermId,
    firstYear,
    program,
    requirementTreeWithStatus,
    unassignedCompletedCourses,
    selectedOptionsPerRequirement,
    wizardFurthestStep,
  } = useAppStore(
    useShallow((s) => ({
      indices: s.indices,
      cache: s.cache,
      terms: s.terms,
      selectedTermId: s.selectedTermId,
      firstYear: s.firstYear,
      program: s.program,
      requirementTreeWithStatus: s.requirementTreeWithStatus,
      unassignedCompletedCourses: s.unassignedCompletedCourses,
      selectedOptionsPerRequirement: s.selectedOptionsPerRequirement,
      wizardFurthestStep: s.wizardFurthestStep,
    })),
  );

  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const resetToDefault = useAppStore((s) => s.resetToDefault);
  const touchWizardFurthestStep = useAppStore((s) => s.touchWizardFurthestStep);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const wizardStepContent = getWizardStepContent();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  useEffect(() => {
    touchWizardFurthestStep(active);
  }, [active, touchWizardFurthestStep]);

  const hasTerms = (terms?.length ?? 0) > 0;

  const missingOptions = useMemo(
    () => hasMissingOptionSelections(requirementTreeWithStatus, selectedOptionsPerRequirement),
    [requirementTreeWithStatus, selectedOptionsPerRequirement],
  );

  const needsOptionsStep = useMemo(
    () => requirementTreeWithStatus.some(nodeHasOptionGroups),
    [requirementTreeWithStatus],
  );

  const needsAssignStep = unassignedCompletedCourses.length > 0;

  const proceedCtx = useMemo(
    () => ({
      hasTerms,
      selectedTermId,
      cacheLoaded: Boolean(cache),
      firstYear,
      hasProgram: program !== null,
      missingOptions,
      needsOptionsStep,
      unassignedCount: unassignedCompletedCourses.length,
    }),
    [
      hasTerms,
      selectedTermId,
      cache,
      firstYear,
      program,
      missingOptions,
      needsOptionsStep,
      unassignedCompletedCourses.length,
    ],
  );

  const maxReachable = useMemo(
    () => maxReachableWizardStep(needsOptionsStep, needsAssignStep, proceedCtx),
    [needsOptionsStep, needsAssignStep, proceedCtx],
  );

  const navVisibleStepIndices = useMemo(
    () => buildVisibleStepIndices(needsOptionsStep, needsAssignStep),
    [needsOptionsStep, needsAssignStep],
  );

  const effectiveActive = useMemo(
    () => normalizeActiveStep(active, needsOptionsStep, needsAssignStep),
    [active, needsOptionsStep, needsAssignStep],
  );

  const stepDisplayIndex = Math.max(0, navVisibleStepIndices.indexOf(effectiveActive));
  const visibleStepCount = navVisibleStepIndices.length;

  const sidebarFurthestDisplayIndex = useMemo(
    () => furthestReachedDisplayIndex(ALL_WIZARD_STEP_INDICES, wizardFurthestStep),
    [wizardFurthestStep],
  );

  useEffect(() => {
    if (effectiveActive !== active) {
      navigateToWizardStep(effectiveActive, { replace: true });
    }
  }, [active, effectiveActive]);

  useEffect(() => {
    if (effectiveActive > WizardStep.Options && needsOptionsStep && missingOptions) {
      navigateToWizardStep(WizardStep.Options);
    }
  }, [effectiveActive, needsOptionsStep, missingOptions]);

  useEffect(() => {
    const visible = navVisibleStepIndices;
    const maxIdx = visible.indexOf(maxReachable);
    const activeIdx = visible.indexOf(effectiveActive);
    if (maxIdx === -1 || activeIdx === -1) return;
    if (activeIdx > maxIdx) {
      navigateToWizardStep(maxReachable, { replace: true });
    }
  }, [effectiveActive, maxReachable, navVisibleStepIndices]);

  const setActive = useCallback(
    (stepOrUpdater: number | ((prev: number) => number)) => {
      const step =
        typeof stepOrUpdater === "function" ? stepOrUpdater(effectiveActive) : stepOrUpdater;
      navigateToWizardStep(step as WizardStep);
    },
    [effectiveActive],
  );

  const canProceedFromStep = useMemo(() => {
    const base = canAdvanceWizardStep(effectiveActive, navVisibleStepIndices, maxReachable);
    if (effectiveActive === WizardStep.Mode) {
      return base && modeSelection != null;
    }
    return base;
  }, [effectiveActive, navVisibleStepIndices, maxReachable, modeSelection]);

  const [nextUnlockCue, setNextUnlockCue] = useState(false);
  const prevStepProgressRef = useRef<{
    step: WizardStep;
    canProceed: boolean;
  } | null>(null);

  useEffect(() => {
    let unlockCueTimer: number | null = null;
    if (prevStepProgressRef.current === null) {
      prevStepProgressRef.current = {
        step: effectiveActive,
        canProceed: canProceedFromStep,
      };
      return;
    }
    const was = prevStepProgressRef.current;
    if (was.step !== effectiveActive) {
      prevStepProgressRef.current = {
        step: effectiveActive,
        canProceed: canProceedFromStep,
      };
      return;
    }
    if (!was.canProceed && canProceedFromStep) {
      unlockCueTimer = window.setTimeout(() => setNextUnlockCue(true), 0);
    }
    prevStepProgressRef.current = {
      step: effectiveActive,
      canProceed: canProceedFromStep,
    };
    return () => {
      if (unlockCueTimer !== null) window.clearTimeout(unlockCueTimer);
    };
  }, [effectiveActive, canProceedFromStep]);

  useEffect(() => {
    if (!nextUnlockCue) return;
    const ms = prefersReducedMotion ? 700 : 650;
    const t = window.setTimeout(() => setNextUnlockCue(false), ms);
    return () => window.clearTimeout(t);
  }, [nextUnlockCue, prefersReducedMotion]);

  const handleWizardNext = () => {
    if (effectiveActive === WizardStep.Mode) {
      if (!modeSelection) return;
      if (modeSelection === "basic") {
        applyBasicDefaultsIfUntouched(useAppStore.setState, useAppStore.getState);
        navigateToCalendar("basic");
      } else {
        enterAdvancedWizardFlow(useAppStore.setState, useAppStore.getState);
        navigateToWizardStep(WizardStep.Program);
      }
      return;
    }
    const rawNext = getNextStep(effectiveActive, needsOptionsStep, needsAssignStep);
    navigateToWizardStep(rawNext);
  };

  const handleResetConfirm = () => {
    resetToDefault();
    navigateToWizardStep(WizardStep.Term, { replace: true });
    setResetModalOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        style={{
          minHeight: "100vh",
          padding: isMobile ? "20px 12px 0" : "28px 20px 0",
          paddingBottom: isMobile ? 12 : 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <ResetModal
          opened={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          onConfirm={handleResetConfirm}
        />

        <Modal
          opened={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
          title={wizardStepContent[effectiveActive]?.title ?? tr("app.helpFallback")}
          centered
          radius={0}
          styles={{
            header: {
              backgroundColor: "#1E1E20",
              borderBottom: "1px solid #2C2E33",
            },
            body: { backgroundColor: "#1E1E20" },
            title: { color: "#F8F9FA", fontWeight: 600 },
          }}
        >
          <Stack gap="md">
            <Box>
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                style={{ letterSpacing: "0.08em", color: "#868E96" }}
                mb={6}
              >
                {tr("app.help.whatFor")}
              </Text>
              <Text size="sm" style={{ color: "#ADB5BD", lineHeight: 1.5 }}>
                {wizardStepContent[effectiveActive]?.purpose}
              </Text>
            </Box>
            <Box>
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                style={{ letterSpacing: "0.08em", color: "#868E96" }}
                mb={6}
              >
                {tr("app.help.whatToDo")}
              </Text>
              <Text size="sm" style={{ color: "#ADB5BD", lineHeight: 1.5 }}>
                {wizardStepContent[effectiveActive]?.whatToDo}
              </Text>
            </Box>
          </Stack>
        </Modal>

        <Box component="header">
          <Title
            order={1}
            style={{
              fontFamily: '"DM Serif Display", serif',
              color: "#F8F9FA",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            {tr("landing.schedule.title")}
          </Title>
        </Box>

        <Box style={{ width: "100%" }}>
          <Box
            style={{
              width: "100%",
              maxWidth: 1200,
              margin: "0 auto",
              display: isMobile ? "flex" : "grid",
              flexDirection: isMobile ? "column" : undefined,
              gridTemplateColumns: isMobile
                ? undefined
                : "minmax(0, 260px) minmax(0, 1fr) minmax(0, 260px)",
              justifyContent: "center",
              gap: isMobile ? 20 : 0,
            }}
          >
            <Box
              component="nav"
              aria-label="Wizard Steps"
              style={{
                display: "flex",
                justifyContent: isMobile ? "flex-start" : "flex-end",
                paddingRight: isMobile ? 0 : 28,
                paddingTop: 4,
              }}
            >
              <StepNav
                visibleStepIndices={ALL_WIZARD_STEP_INDICES}
                active={effectiveActive}
                furthestDisplayIndex={sidebarFurthestDisplayIndex}
                furthestActualStep={wizardFurthestStep}
                needsOptionsStep={needsOptionsStep}
                needsAssignStep={needsAssignStep}
                onStepClick={setActive}
                isMobile={isMobile ?? false}
              />
            </Box>

            <Box component="main" style={{ minWidth: 0 }}>
              <Box
                style={{
                  backgroundColor: "#1E1E20",
                  ...(isMobile
                    ? { border: "none", padding: 12 }
                    : { border: "2px solid #2C2E33", padding: 24 }),
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.section
                    key={effectiveActive}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    aria-labelledby="step-heading"
                  >
                    <Group justify="space-between" mb={8}>
                      <Text
                        id="step-heading"
                        size="xs"
                        fw={500}
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#A6A7AB",
                        }}
                      >
                        {tr("app.stepHeader", {
                          current: stepDisplayIndex + 1,
                          total: visibleStepCount,
                          description: STEPS[effectiveActive].description().toUpperCase(),
                        }).toUpperCase()}
                      </Text>
                      <Group gap="xs">
                        {indices && (
                          <Tooltip
                            label="Copied to clipboard!"
                            opened={shareCopied}
                            position="bottom"
                            withArrow
                            color="dark"
                          >
                            <Button
                              data-tour="share"
                              variant="subtle"
                              color="gray"
                              size="xs"
                              leftSection={<IconShare size={14} />}
                              onClick={handleCopyShare}
                            >
                              {tr("app.share.action")}
                            </Button>
                          </Tooltip>
                        )}
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<IconHelp size={14} />}
                          onClick={() => setHelpModalOpen(true)}
                        >
                          {tr("app.help.action")}
                        </Button>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<IconCompass size={14} />}
                          onClick={() => runTour(navVisibleStepIndices)}
                        >
                          {tr("app.tour.action")}
                        </Button>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<IconRefresh size={14} />}
                          onClick={() => setResetModalOpen(true)}
                        >
                          {tr("app.reset.action")}
                        </Button>
                      </Group>
                    </Group>

                    {children}
                  </motion.section>
                </AnimatePresence>

                <Box
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    marginTop: 24,
                    marginLeft: isMobile ? -12 : -24,
                    marginRight: isMobile ? -12 : -24,
                    paddingInline: isMobile ? 12 : 24,
                    paddingTop: 16,
                    paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                    backgroundColor: "#1E1E20",
                    borderTop: "1px solid #2C2E33",
                  }}
                >
                  <Group justify="space-between">
                    <Button
                      variant="subtle"
                      color="gray"
                      radius={0}
                      onClick={() =>
                        navigateToWizardStep(
                          getPrevStep(effectiveActive, needsOptionsStep, needsAssignStep),
                        )
                      }
                      disabled={effectiveActive === WizardStep.Term}
                      style={{ border: "none" }}
                    >
                      {tr("app.nav.back")}
                    </Button>
                    <motion.div
                      style={{ display: "inline-block" }}
                      animate={
                        nextUnlockCue && !prefersReducedMotion
                          ? { x: [0, -6, 6, -5, 5, -3, 3, 0] }
                          : { x: 0 }
                      }
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                    >
                      <Button
                        color={nextUnlockCue ? "violet" : "constructBlack"}
                        radius={0}
                        onClick={handleWizardNext}
                        disabled={!canProceedFromStep}
                      >
                        {tr("app.nav.next")}
                      </Button>
                    </motion.div>
                  </Group>
                </Box>
              </Box>
            </Box>

            {!isMobile && <Box />}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

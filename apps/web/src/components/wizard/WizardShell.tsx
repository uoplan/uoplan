import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
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
import { usePersistState } from "../../hooks/usePersistState";
import { useShareUrl } from "../../hooks/useShareUrl";
import { getWizardStepContent } from "../../lib/wizardStepContent";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";

const ONTARIO_FIPPA_ACT_URL = "https://www.ontario.ca/laws/statute/90f31";

export type WizardShellProps = {
  activeStep: WizardStep;
  children: ReactNode;
};

export function WizardShell({ activeStep: active, children }: WizardShellProps) {
  useLingui();

  const {
    indices,
    cache,
    terms,
    selectedTermId,
    wizardMode,
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
      wizardMode: s.wizardMode,
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

  const [isLangTransitioning, setIsLangTransitioning] = useState(false);
  const handleLangSwitch = useCallback(
    async (locale: AppLocale) => {
      if (prefersReducedMotion) {
        await dynamicActivate(locale);
        return;
      }
      setIsLangTransitioning(true);
      await new Promise((r) => setTimeout(r, 130));
      await dynamicActivate(locale);
      setIsLangTransitioning(false);
    },
    [prefersReducedMotion],
  );

  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  usePersistState(!!indices);

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
      wizardMode,
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
      wizardMode,
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
    if (wizardMode === "basic" && effectiveActive > WizardStep.Mode) {
      navigateToCalendar("basic", { replace: true });
    }
  }, [wizardMode, effectiveActive]);

  useEffect(() => {
    if (effectiveActive !== active) {
      navigateToWizardStep(effectiveActive, { replace: true });
    }
  }, [active, effectiveActive]);

  useEffect(() => {
    if (
      wizardMode !== "basic" &&
      effectiveActive > WizardStep.Options &&
      needsOptionsStep &&
      missingOptions
    ) {
      navigateToWizardStep(WizardStep.Options);
    }
  }, [wizardMode, effectiveActive, needsOptionsStep, missingOptions]);

  useEffect(() => {
    if (wizardMode === "basic") return;
    const visible = navVisibleStepIndices;
    const maxIdx = visible.indexOf(maxReachable);
    const activeIdx = visible.indexOf(effectiveActive);
    if (maxIdx === -1 || activeIdx === -1) return;
    if (activeIdx > maxIdx) {
      navigateToWizardStep(maxReachable, { replace: true });
    }
  }, [wizardMode, effectiveActive, maxReachable, navVisibleStepIndices]);

  const setActive = useCallback(
    (stepOrUpdater: number | ((prev: number) => number)) => {
      const step =
        typeof stepOrUpdater === "function" ? stepOrUpdater(effectiveActive) : stepOrUpdater;
      navigateToWizardStep(step as WizardStep);
    },
    [effectiveActive],
  );

  const canProceedFromStep = useMemo(
    () => canAdvanceWizardStep(effectiveActive, navVisibleStepIndices, maxReachable),
    [effectiveActive, navVisibleStepIndices, maxReachable],
  );

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
    if (wizardMode === "basic" && effectiveActive === WizardStep.Mode) {
      navigateToCalendar("basic");
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
            uoplan.party
            <Badge color="blue" variant="light" size="sm">
              {tr("app.beta")}
            </Badge>
          </Title>
        </Box>

        <motion.div
          animate={{ opacity: isLangTransitioning ? 0 : 1, y: isLangTransitioning ? 4 : 0 }}
          transition={{ duration: isLangTransitioning ? 0.13 : 0.2, ease: "easeInOut" }}
          style={{ width: "100%" }}
        >
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
                        <LanguageSwitcher onSwitch={handleLangSwitch} />
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
        </motion.div>

        <Box
          component="footer"
          mt={isMobile ? 20 : 28}
          pt={isMobile ? 14 : 18}
          pb="max(14px, env(safe-area-inset-bottom))"
          style={{
            alignSelf: "stretch",
            marginLeft: isMobile ? -12 : -20,
            marginRight: isMobile ? -12 : -20,
            borderTop: "1px solid #2C2E33",
          }}
        >
          <Box
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              paddingLeft: isMobile ? 12 : 20,
              paddingRight: isMobile ? 12 : 20,
              ...(isMobile
                ? {}
                : {
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr) minmax(0, 260px)",
                  }),
            }}
          >
            {!isMobile ? <Box /> : null}

            <Stack gap="lg">
              <Group
                gap={12}
                wrap="wrap"
                justify={isMobile ? "center" : "flex-start"}
                align="baseline"
              >
                <Anchor
                  href="https://github.com/uoplan/uoplan"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  c="dimmed"
                  underline="never"
                  lh={1.45}
                  styles={{
                    root: {
                      "&:hover": {
                        color: "var(--mantine-color-gray-4)",
                        textDecoration: "underline",
                      },
                    },
                  }}
                >
                  github
                </Anchor>
                <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                  ·
                </Text>
                <Text
                  component={Link}
                  to="/changelog"
                  size="sm"
                  c="dimmed"
                  lh={1.45}
                  style={{
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                  styles={{
                    root: {
                      "&:hover": {
                        color: "var(--mantine-color-gray-4)",
                        textDecoration: "underline",
                      },
                    },
                  }}
                >
                  {tr("app.footer.changelog")}
                </Text>
                <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                  ·
                </Text>
                <Text span size="xs" c="dimmed" ff="monospace" lh={1.45} style={{ opacity: 0.85 }}>
                  {(typeof __BRANCH_NAME__ !== "undefined" && __BRANCH_NAME__
                    ? __BRANCH_NAME__
                    : tr("app.footer.buildBranchFallback")
                  ).toLowerCase()}
                  {" · "}
                  {(typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev").toLowerCase()}
                </Text>
                <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                  ·
                </Text>
                <Text span size="sm" c="dimmed" lh={1.45}>
                  {tr("app.footer.feedbackPrompt")}{" "}
                  <Anchor href="mailto:admin@uoplan.party" size="sm" c="dimmed" underline="hover">
                    admin@uoplan.party
                  </Anchor>
                </Text>
              </Group>

              <Box
                role="note"
                style={{
                  ...(isMobile
                    ? {
                        maxWidth: 440,
                        marginLeft: "auto",
                        marginRight: "auto",
                      }
                    : {
                        borderLeft: "2px solid rgba(124, 58, 237, 0.38)",
                        paddingLeft: 14,
                      }),
                  paddingTop: 2,
                }}
              >
                <Text
                  size="sm"
                  lh={1.65}
                  ta={isMobile ? "center" : "left"}
                  style={{
                    fontStyle: "italic",
                    letterSpacing: "0.01em",
                    color: "#868E96",
                  }}
                >
                  {tr("app.footer.gradeDataAttribution.before")}
                  <Anchor
                    href={ONTARIO_FIPPA_ACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    display="inline"
                    fz="sm"
                    lh={1.65}
                    underline="hover"
                    style={{
                      fontStyle: "italic",
                      letterSpacing: "0.01em",
                      color: "#868E96",
                    }}
                    styles={{
                      root: {
                        "&:hover": {
                          color: "var(--mantine-color-gray-4)",
                        },
                      },
                    }}
                  >
                    {tr("app.footer.gradeDataAttribution.actLink")}
                  </Anchor>
                  {tr("app.footer.gradeDataAttribution.after")}
                </Text>
              </Box>
            </Stack>

            {!isMobile ? <Box /> : null}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

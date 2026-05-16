import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react";
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconChevronDown,
  IconCompass,
  IconHelp,
  IconRefresh,
  IconShare,
} from "@tabler/icons-react";
import { runTour } from "./tour";
import { useAppStore } from "./store/appStore";
import { useShallow } from "zustand/react/shallow";
import { STEPS, StepNav } from "./components/shared/StepNav";
import { ChangelogModal } from "./components/shared/ChangelogModal";
import { ResetModal } from "./components/shared/ResetModal";
import { CalendarPage } from "./components/calendar/CalendarPage";
import { TermStep } from "./components/steps/TermStep";
import { ModeStep } from "./components/steps/ModeStep";
import { ProgramStep } from "./components/steps/ProgramStep";
import { CompletedCoursesStep } from "./components/steps/CompletedCoursesStep";
import { AssignStep } from "./components/requirements/AssignStep";
import { ConstrainStep } from "./components/requirements/ConstrainStep";
import { OptionsStep } from "./components/requirements/OptionsStep";
import {
  hasMissingOptionSelections,
  nodeHasOptionGroups,
} from "./components/requirements/requirementUtils";
import {
  ALL_WIZARD_STEP_INDICES,
  buildVisibleStepIndices,
  furthestReachedDisplayIndex,
  getNextStep,
  getPrevStep,
  normalizeActiveStep,
  WizardStep,
} from "./lib/wizardSteps";
import { ScheduleCountStep } from "./components/steps/ScheduleCountStep";
import { usePersistState } from "./hooks/usePersistState";
import { useNavHistory } from "./hooks/useNavHistory";
import { useShareUrl } from "./hooks/useShareUrl";
import { getWizardStepContent } from "./lib/wizardStepContent";
import { LanguageSwitcher } from "./components/shared/LanguageSwitcher";
import { dynamicActivate, tr, type AppLocale } from "./i18n";

const ONTARIO_FIPPA_ACT_URL = "https://www.ontario.ca/laws/statute/90f31";

function App() {
  // Subscribe App to locale changes so all text helpers re-render.
  useLingui();

  const {
    catalogue,
    indices,
    cache,
    loading,
    error,
    terms,
    selectedTermId,
    wizardMode,
    firstYear,
    program,
    completedCourses,
    remainingRequirements,
    requirementTreeWithStatus,
    completedRequirementsList,
    unassignedCompletedCourses,
    selectedPerRequirement,
    constrainedPerRequirement,
    selectedOptionsPerRequirement,
    coursesThisSemester,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    currentSchedule,
    generationError,
    filteredPrereqEligibleCourses,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    generationLimitFirstYearCredits,
    generationCompressedSchedule,
    generationPreferEasier,
  } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      indices: s.indices,
      cache: s.cache,
      loading: s.loading,
      error: s.error,
      terms: s.terms,
      selectedTermId: s.selectedTermId,
      wizardMode: s.wizardMode,
      firstYear: s.firstYear,
      program: s.program,
      completedCourses: s.completedCourses,
      remainingRequirements: s.remainingRequirements,
      requirementTreeWithStatus: s.requirementTreeWithStatus,
      completedRequirementsList: s.completedRequirementsList,
      unassignedCompletedCourses: s.unassignedCompletedCourses,
      selectedPerRequirement: s.selectedPerRequirement,
      constrainedPerRequirement: s.constrainedPerRequirement,
      selectedOptionsPerRequirement: s.selectedOptionsPerRequirement,
      coursesThisSemester: s.coursesThisSemester,
      generationMinStartMinutes: s.generationMinStartMinutes,
      generationMaxEndMinutes: s.generationMaxEndMinutes,
      generationAllowedDays: s.generationAllowedDays,
      generationMinProfessorRating: s.generationMinProfessorRating,
      currentSchedule: s.currentSchedule,
      generationError: s.generationError,
      filteredPrereqEligibleCourses: s.filteredPrereqEligibleCourses,
      levelBuckets: s.levelBuckets,
      languageBuckets: s.languageBuckets,
      electiveLevelBuckets: s.electiveLevelBuckets,
      includeClosedComponents: s.includeClosedComponents,
      virtualSectionsOnly: s.virtualSectionsOnly,
      generationLimitFirstYearCredits: s.generationLimitFirstYearCredits,
      generationCompressedSchedule: s.generationCompressedSchedule,
      generationPreferEasier: s.generationPreferEasier,
    })),
  );

  const loadData = useAppStore((s) => s.loadData);
  const firstSeed = useAppStore((s) => s.firstSeed);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const setWizardMode = useAppStore((s) => s.setWizardMode);
  const setProgram = useAppStore((s) => s.setProgram);
  const setSelectedTermId = useAppStore((s) => s.setSelectedTermId);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);
  const setSelectedForRequirement = useAppStore((s) => s.setSelectedForRequirement);
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);
  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
  const setSelectedOptionForRequirement = useAppStore((s) => s.setSelectedOptionForRequirement);
  const clearSelectedOptionForRequirement = useAppStore((s) => s.clearSelectedOptionForRequirement);
  const generateSchedules = useAppStore((s) => s.generateSchedules);
  const setGenerationMinProfessorRating = useAppStore((s) => s.setGenerationMinProfessorRating);
  const setGenerationMinStartMinutes = useAppStore((s) => s.setGenerationMinStartMinutes);
  const setGenerationMaxEndMinutes = useAppStore((s) => s.setGenerationMaxEndMinutes);
  const setGenerationAllowedDays = useAppStore((s) => s.setGenerationAllowedDays);
  const setLevelBuckets = useAppStore((s) => s.setLevelBuckets);
  const setLanguageBuckets = useAppStore((s) => s.setLanguageBuckets);
  const setElectiveLevelBuckets = useAppStore((s) => s.setElectiveLevelBuckets);
  const setIncludeClosedComponents = useAppStore((s) => s.setIncludeClosedComponents);
  const setVirtualSectionsOnly = useAppStore((s) => s.setVirtualSectionsOnly);
  const setGenerationLimitFirstYearCredits = useAppStore(
    (s) => s.setGenerationLimitFirstYearCredits,
  );
  const setGenerationCompressedSchedule = useAppStore((s) => s.setGenerationCompressedSchedule);
  const setGenerationPreferEasier = useAppStore((s) => s.setGenerationPreferEasier);
  const resetToDefault = useAppStore((s) => s.resetToDefault);

  const {
    active,
    setActive,
    replaceActive,
    showCalendar,
    setShowCalendar,
    resetNav,
    furthestStep,
  } = useNavHistory();
  const [generating, setGenerating] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [changelogModalOpen, setChangelogModalOpen] = useState(false);
  const [constrainOpen, setConstrainOpen] = useState(false);
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

  // Use extracted hooks
  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  usePersistState(!!indices);

  // When a shared URL is loaded with showCalendar=true, the schedule hasn't been
  // generated yet. Re-generate once after data loads to restore the calendar view.
  const hasAutoGeneratedRef = useRef(false);
  useEffect(() => {
    if (hasAutoGeneratedRef.current || !indices) return;
    if (showCalendar && currentSchedule === null && firstSeed > 0) {
      hasAutoGeneratedRef.current = true;
      void generateSchedules();
    }
  }, [indices, showCalendar, currentSchedule, firstSeed, generateSchedules]);

  const programs = catalogue?.programs ?? [];
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
    () => furthestReachedDisplayIndex(ALL_WIZARD_STEP_INDICES, furthestStep),
    [furthestStep],
  );

  useEffect(() => {
    if (effectiveActive !== active) replaceActive(effectiveActive);
  }, [active, effectiveActive, replaceActive]);

  // Redirect back to Options step if user bypassed it without selecting required paths
  useEffect(() => {
    if (
      wizardMode !== "basic" &&
      effectiveActive > WizardStep.Options &&
      needsOptionsStep &&
      missingOptions
    ) {
      setActive(WizardStep.Options);
    }
  }, [wizardMode, effectiveActive, needsOptionsStep, missingOptions, setActive]);

  const canProceedFromStep = (() => {
    if (effectiveActive === WizardStep.Term)
      return hasTerms && Boolean(selectedTermId) && Boolean(cache);
    if (effectiveActive === WizardStep.Mode) return Boolean(wizardMode);
    if (effectiveActive === WizardStep.Program) return firstYear !== null && program !== null;
    if (effectiveActive === WizardStep.Options) return !missingOptions;
    if (effectiveActive === WizardStep.Assign) return unassignedCompletedCourses.length === 0;
    return true;
  })();

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
    if (!was.canProceed && canProceedFromStep && effectiveActive !== WizardStep.Generate) {
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

  const handleGenerate = () => {
    setGenerating(true);
    void generateSchedules()
      .then(() => {
        setShowCalendar(true);
      })
      .finally(() => {
        setGenerating(false);
      });
  };

  const uniqueSelected = new Set(Object.values(selectedPerRequirement).flat()).size;

  // First-year credit totals used by ScheduleCountStep.
  const completedFirstYearCredits = completedCourses.reduce((sum, code) => {
    const m = code.match(/\d{4}/);
    if (!m || Number(m[0]) >= 2000) return sum;
    return sum + (cache?.getCourse(code)?.credits ?? 3);
  }, 0);
  const selectedFirstYearCredits = [...new Set(Object.values(selectedPerRequirement).flat())]
    .filter((code) => !completedCourses.includes(code))
    .reduce((sum, code) => {
      const m = code.match(/\d{4}/);
      if (!m || Number(m[0]) >= 2000) return sum;
      return sum + (cache?.getCourse(code)?.credits ?? 3);
    }, 0);
  const totalFirstYearCredits = completedFirstYearCredits + selectedFirstYearCredits;
  const warnFirstYearLimit = totalFirstYearCredits > 48;

  if (loading) {
    return (
      <Box
        component="main"
        style={{
          minHeight: "100vh",
          padding: "60px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack align="center" justify="center" gap="md">
          <Loader size="lg" color="constructBlack" />
          <Text size="sm" c="dimmed">
            {tr("app.loadingData")}
          </Text>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        component="main"
        style={{
          minHeight: "100vh",
          padding: "60px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          withBorder
          style={{
            border: "2px solid #2C2E33",
            padding: 32,
            maxWidth: 480,
            width: "100%",
            backgroundColor: "#1E1E20",
          }}
        >
          <Alert color="red" title={tr("app.errorTitle")}>
            {error}
          </Alert>
        </Paper>
      </Box>
    );
  }

  const showAdvancedCalendar = showCalendar && currentSchedule !== null && wizardMode !== "basic";
  const showBasicCalendar = wizardMode === "basic" && active > WizardStep.Mode;

  return (
    <AnimatePresence mode="wait">
      {showAdvancedCalendar || showBasicCalendar ? (
        <motion.div
          key={showAdvancedCalendar ? "advanced-calendar" : "basic-calendar"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ width: "100%", minHeight: "100vh" }}
        >
          <CalendarPage
            onBack={() => {
              if (wizardMode === "basic") {
                setActive(WizardStep.Mode);
              } else {
                setShowCalendar(false);
              }
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="wizard"
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
              onConfirm={() => {
                resetToDefault();
                resetNav();
                setResetModalOpen(false);
              }}
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

            <ChangelogModal
              opened={changelogModalOpen}
              onClose={() => setChangelogModalOpen(false)}
            />

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
                {/* Step navigation sidebar */}
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
                    furthestActualStep={furthestStep}
                    needsOptionsStep={needsOptionsStep}
                    needsAssignStep={needsAssignStep}
                    onStepClick={setActive}
                    isMobile={isMobile ?? false}
                  />
                </Box>

                {/* Main wizard panel */}
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
                        {/* Step header row */}
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
                              onClick={() => runTour(setActive, navVisibleStepIndices)}
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

                        {/* Step content */}
                        {effectiveActive === WizardStep.Term && terms && (
                          <Stack gap="md">
                            <TermStep
                              terms={terms}
                              value={selectedTermId}
                              onChange={(termId) => {
                                void setSelectedTermId(termId);
                              }}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Mode && (
                          <Stack gap="md">
                            <ModeStep
                              value={wizardMode}
                              onChange={(mode) => {
                                setWizardMode(mode);
                                if (mode === "basic") {
                                  // Jump to generate basic schedules directly if desired, but they have to proceed.
                                }
                              }}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Program && (
                          <Stack gap="md">
                            <ProgramStep
                              programs={programs}
                              value={program?.url ?? null}
                              onChange={setProgram}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Completed && (
                          <Stack gap="md">
                            <CompletedCoursesStep
                              cache={cache}
                              remainingRequirements={remainingRequirements}
                              completedCourses={completedCourses}
                              onChange={setCompletedCourses}
                              hasProgram={!!program}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Options && (
                          <Stack gap="md">
                            <OptionsStep
                              requirementTreeWithStatus={requirementTreeWithStatus}
                              completedCourses={completedCourses}
                              selectedOptionsPerRequirement={selectedOptionsPerRequirement}
                              onSelectOption={setSelectedOptionForRequirement}
                              onClearOption={clearSelectedOptionForRequirement}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Assign && (
                          <Stack gap="md">
                            <AssignStep
                              cache={cache}
                              remainingRequirements={remainingRequirements}
                              requirementTreeWithStatus={requirementTreeWithStatus}
                              completedRequirementsList={completedRequirementsList}
                              completedCourses={completedCourses}
                              unassignedCompletedCourses={unassignedCompletedCourses}
                              constrainedPerRequirement={constrainedPerRequirement}
                              selectedPerRequirement={selectedPerRequirement}
                              onSelect={setSelectedForRequirement}
                              selectedOptionsPerRequirement={selectedOptionsPerRequirement}
                              prereqEligibleCourses={filteredPrereqEligibleCourses}
                              includeClosedComponents={includeClosedComponents}
                              virtualSectionsOnly={virtualSectionsOnly}
                            />
                          </Stack>
                        )}
                        {effectiveActive === WizardStep.Generate && (
                          <Stack gap="md">
                            <ScheduleCountStep
                              coursesThisSemester={coursesThisSemester}
                              onCoursesChange={setCoursesThisSemester}
                              selectedCount={uniqueSelected}
                              minStartMinutes={generationMinStartMinutes}
                              onMinStartMinutesChange={setGenerationMinStartMinutes}
                              maxEndMinutes={generationMaxEndMinutes}
                              onMaxEndMinutesChange={setGenerationMaxEndMinutes}
                              allowedDays={generationAllowedDays}
                              onAllowedDaysChange={setGenerationAllowedDays}
                              minProfessorRating={generationMinProfessorRating}
                              onMinProfessorRatingChange={setGenerationMinProfessorRating}
                              totalFirstYearCredits={totalFirstYearCredits}
                              warnFirstYearLimit={warnFirstYearLimit}
                              limitFirstYearCredits={generationLimitFirstYearCredits}
                              onLimitFirstYearCreditsChange={setGenerationLimitFirstYearCredits}
                              compressedSchedule={generationCompressedSchedule}
                              onCompressedScheduleChange={setGenerationCompressedSchedule}
                              preferEasierCourses={generationPreferEasier}
                              onPreferEasierCoursesChange={setGenerationPreferEasier}
                              onGenerate={handleGenerate}
                              generating={generating}
                              error={generationError?.message ?? null}
                              errorDetails={generationError?.details ?? null}
                              disableGenerate={unassignedCompletedCourses.length > 0}
                              disableGenerateReason={tr("app.generate.disableReason", {
                                count: unassignedCompletedCourses.length,
                                suffix: unassignedCompletedCourses.length === 1 ? "" : "s",
                              })}
                              beforeGenerate={
                                <Paper
                                  withBorder
                                  radius={0}
                                  style={{
                                    backgroundColor: constrainOpen
                                      ? "var(--mantine-color-dark-6)"
                                      : "var(--mantine-color-dark-8)",
                                  }}
                                >
                                  <Group
                                    justify="space-between"
                                    align="center"
                                    p="sm"
                                    mb="xs"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => setConstrainOpen((o) => !o)}
                                    aria-expanded={constrainOpen}
                                    aria-controls="constraints-collapse"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setConstrainOpen((o) => !o);
                                      }
                                    }}
                                  >
                                    <Group gap="xs" align="center">
                                      <IconChevronDown
                                        size={14}
                                        aria-hidden="true"
                                        style={{
                                          flexShrink: 0,
                                          transform: constrainOpen
                                            ? "rotate(0deg)"
                                            : "rotate(-90deg)",
                                          transition: "transform 150ms ease",
                                        }}
                                      />
                                      <Text fw={600} size="sm">
                                        {tr("app.constraints.heading")}
                                      </Text>
                                    </Group>
                                    <Badge size="sm" variant="light" color="violet">
                                      {tr("app.constraints.optional")}
                                    </Badge>
                                  </Group>
                                  <Collapse id="constraints-collapse" in={!constrainOpen}>
                                    <Alert
                                      color="blue"
                                      variant="light"
                                      radius={0}
                                      mx="sm"
                                      mb="sm"
                                      style={{ border: "none" }}
                                    >
                                      <Text size="sm">{tr("app.constraints.description")}</Text>
                                    </Alert>
                                  </Collapse>
                                  <Collapse id="constraints-collapse-open" in={constrainOpen}>
                                    <Box p="sm" pt={0}>
                                      <ConstrainStep
                                        cache={cache}
                                        remainingRequirements={remainingRequirements}
                                        requirementTreeWithStatus={requirementTreeWithStatus}
                                        completedRequirementsList={completedRequirementsList}
                                        completedCourses={completedCourses}
                                        selectedPerRequirement={selectedPerRequirement}
                                        constrainedPerRequirement={constrainedPerRequirement}
                                        onConstrain={setConstrainedForRequirement}
                                        selectedOptionsPerRequirement={
                                          selectedOptionsPerRequirement
                                        }
                                        prereqEligibleCourses={filteredPrereqEligibleCourses}
                                        levelBuckets={levelBuckets}
                                        languageBuckets={languageBuckets}
                                        onChangeLevelBuckets={setLevelBuckets}
                                        onChangeLanguageBuckets={setLanguageBuckets}
                                        electiveLevelBuckets={electiveLevelBuckets}
                                        onChangeElectiveLevelBuckets={setElectiveLevelBuckets}
                                        includeClosedComponents={includeClosedComponents}
                                        onIncludeClosedComponentsChange={setIncludeClosedComponents}
                                        virtualSectionsOnly={virtualSectionsOnly}
                                        onVirtualSectionsOnlyChange={setVirtualSectionsOnly}
                                      />
                                    </Box>
                                  </Collapse>
                                </Paper>
                              }
                            />
                          </Stack>
                        )}
                      </motion.section>
                    </AnimatePresence>

                    {/* Outside motion.div so position:sticky works (transform breaks sticky). */}
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
                            setActive(
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
                            onClick={() =>
                              setActive(
                                getNextStep(effectiveActive, needsOptionsStep, needsAssignStep),
                              )
                            }
                            disabled={
                              effectiveActive === WizardStep.Generate || !canProceedFromStep
                            }
                          >
                            {tr("app.nav.next")}
                          </Button>
                        </motion.div>
                      </Group>
                    </Box>
                  </Box>
                </Box>

                {/* Right gutter (desktop only) */}
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
                    <UnstyledButton
                      type="button"
                      onClick={() => setChangelogModalOpen(true)}
                      fz="sm"
                      c="dimmed"
                      p={0}
                      h="auto"
                      lh={1.45}
                      display="inline"
                      style={{ textDecoration: "none", verticalAlign: "baseline" }}
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
                    </UnstyledButton>
                    <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                      ·
                    </Text>
                    <Text
                      span
                      size="xs"
                      c="dimmed"
                      ff="monospace"
                      lh={1.45}
                      style={{ opacity: 0.85 }}
                    >
                      {(typeof __BRANCH_NAME__ !== "undefined" && __BRANCH_NAME__
                        ? __BRANCH_NAME__
                        : tr("app.footer.buildBranchFallback")
                      ).toLowerCase()}
                      {" · "}
                      {(typeof __COMMIT_HASH__ !== "undefined"
                        ? __COMMIT_HASH__
                        : "dev"
                      ).toLowerCase()}
                    </Text>
                    <Text span size="sm" c="dimmed" lh={1.45} style={{ opacity: 0.42 }}>
                      ·
                    </Text>
                    <Text span size="sm" c="dimmed" lh={1.45}>
                      {tr("app.footer.feedbackPrompt")}{" "}
                      <Anchor
                        href="mailto:admin@uoplan.party"
                        size="sm"
                        c="dimmed"
                        underline="hover"
                      >
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
      )}
    </AnimatePresence>
  );
}

export default App;

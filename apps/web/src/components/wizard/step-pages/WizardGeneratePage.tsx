import { useState } from "react";
import { Alert, Badge, Box, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useAppStore } from "../../../store/appStore";
import { ConstrainStep } from "../../requirements/ConstrainStep";
import { ScheduleCountStep } from "../../steps/ScheduleCountStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { navigateToCalendar } from "../../../lib/appNavigation";
import { WizardShell } from "../WizardShell";
import { tr } from "../../../i18n";

export function WizardGeneratePage() {
  return (
    <WizardShell activeStep={WizardStep.Generate}>
      <WizardGenerateStepBody />
    </WizardShell>
  );
}

function WizardGenerateStepBody() {
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedRequirementsList = useAppStore((s) => s.completedRequirementsList);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const filteredPrereqEligibleCourses = useAppStore((s) => s.filteredPrereqEligibleCourses);
  const coursesThisSemester = useAppStore((s) => s.coursesThisSemester);
  const generationMinStartMinutes = useAppStore((s) => s.generationMinStartMinutes);
  const generationMaxEndMinutes = useAppStore((s) => s.generationMaxEndMinutes);
  const generationAllowedDays = useAppStore((s) => s.generationAllowedDays);
  const generationMinProfessorRating = useAppStore((s) => s.generationMinProfessorRating);
  const generationError = useAppStore((s) => s.generationError);
  const levelBuckets = useAppStore((s) => s.levelBuckets);
  const languageBuckets = useAppStore((s) => s.languageBuckets);
  const electiveLevelBuckets = useAppStore((s) => s.electiveLevelBuckets);
  const includeClosedComponents = useAppStore((s) => s.includeClosedComponents);
  const virtualSectionsOnly = useAppStore((s) => s.virtualSectionsOnly);
  const generationLimitFirstYearCredits = useAppStore((s) => s.generationLimitFirstYearCredits);
  const generationCompressedSchedule = useAppStore((s) => s.generationCompressedSchedule);
  const generationPreferEasier = useAppStore((s) => s.generationPreferEasier);
  const unassignedCompletedCourses = useAppStore((s) => s.unassignedCompletedCourses);

  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
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
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);

  const [generating, setGenerating] = useState(false);
  const [constrainOpen, setConstrainOpen] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    void (async () => {
      try {
        await generateSchedules();
        const { currentSchedule, generationError: genErr } = useAppStore.getState();
        if (currentSchedule !== null && genErr === null) {
          navigateToCalendar("advanced");
        }
      } finally {
        setGenerating(false);
      }
    })();
  };

  const uniqueSelected = new Set(Object.values(selectedPerRequirement).flat()).size;

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

  return (
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
                    transform: constrainOpen ? "rotate(0deg)" : "rotate(-90deg)",
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
                  selectedOptionsPerRequirement={selectedOptionsPerRequirement}
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
  );
}

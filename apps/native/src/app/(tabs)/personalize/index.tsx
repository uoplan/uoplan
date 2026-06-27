import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import type { SchedulesData } from "@uoplan/core/dataTypes";
import { isOptCourse, normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { formatTermNameEn } from "@uoplan/core/gradeTrends";

import { NotificationToggle } from "@/components/notification-toggle";
import { OptionsStep } from "@/components/personalize/options-step";
import { ProgramOptionsStep } from "@/components/personalize/program-options-step";
import { RequirementsStep } from "@/components/personalize/requirements-step";
import { TermStep } from "@/components/personalize/term-step";
import {
  TranscriptStep,
  type TranscriptImportSummary,
} from "@/components/personalize/transcript-step";
import { PagedStepper, type PagedStep } from "@/components/paged-stepper";
import { type SearchableSelectOption } from "@/components/searchable-select";
import { Surface } from "@/constants/theme";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useAppData, useExploreIndex } from "@/data/data-provider";
import type { ExploreProgramEntry } from "@/data/explore-index";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { useAnalytics } from "@/lib/analytics";
import { findBestMatchingProgram, processExtractedPages } from "@/lib/parseTranscriptNative";
import type { PdfPageText } from "@/lib/parseTranscriptNative";
import {
  computePersonalizeRequirements,
  DEFAULT_REQUIREMENT_SELECTIONS,
  hasMissingProgramOptions,
  programHasOptionGroups,
  setActiveScheduleRequirementContext,
  type PersonalizeRequirementSelections,
} from "@/lib/personalize-requirements";

export function programOptionsFromEntries(
  programs: readonly ExploreProgramEntry[],
): SearchableSelectOption[] {
  const seen = new Set<string>();
  const unique = programs.filter((program) => {
    if (seen.has(program.url)) return false;
    seen.add(program.url);
    return true;
  });
  const totals = new Map<string, number>();
  for (const program of unique) {
    totals.set(program.title, (totals.get(program.title) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  return unique.map((program) => {
    const occurrence = (occurrences.get(program.title) ?? 0) + 1;
    occurrences.set(program.title, occurrence);
    const label =
      (totals.get(program.title) ?? 0) > 1 ? `${program.title} (${occurrence})` : program.title;
    return {
      value: program.url,
      label,
      searchText: `${program.title} ${program.slug ?? ""} ${program.url}`,
    };
  });
}

/**
 * Personalize wizard, the native analogue of the web /personalize page: a
 * guided, swipeable flow for term, transcript import, manual options, and
 * requirements. Generate switches to the Schedule tab, where the native engine
 * builds timetables from the persisted basket and requirement context.
 */
export default function PersonalizeScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { bundle, schedulesByTerm, catalogueYears } = useAppData();
  const index = useExploreIndex();
  const completed = useCompletedCourses();
  const { personalization, setPersonalization } = useScheduleOptions();
  const [requirementSelections, setRequirementSelections] =
    useState<PersonalizeRequirementSelections>(DEFAULT_REQUIREMENT_SELECTIONS);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptSummary, setTranscriptSummary] = useState<TranscriptImportSummary | null>(null);

  const termOptions = useMemo<SearchableSelectOption[]>(
    () =>
      [...bundle.terms]
        .sort((a, b) => String(b.termId).localeCompare(String(a.termId)))
        .map((term) => ({
          value: String(term.termId),
          label: term.name,
          searchText: `${term.termId} ${term.name}`,
        })),
    [bundle.terms],
  );

  const startYearOptions = useMemo<SearchableSelectOption[]>(
    () =>
      [...new Set(catalogueYears)]
        .sort((a, b) => b - a)
        .map((year) => ({ value: String(year), label: `${year}–${year + 1}` })),
    [catalogueYears],
  );

  const programOptions = useMemo(() => programOptionsFromEntries(index.programs), [index.programs]);

  const courseOptions = useMemo<SearchableSelectOption[]>(
    () =>
      index.courses.map((course) => ({
        value: course.code,
        label: course.code,
        description: course.title,
        searchText: `${course.code} ${course.title}`,
      })),
    [index.courses],
  );

  const coursesByCode = useMemo(
    () => new Map(index.courses.map((course) => [course.code, course] as const)),
    [index.courses],
  );

  useEffect(() => {
    if (personalization.termId === null && termOptions.length > 0) {
      setPersonalization({ termId: termOptions[0]!.value });
    }
  }, [personalization.termId, setPersonalization, termOptions]);

  const term = personalization.termId;
  const startYear = personalization.startYear;
  const program = personalization.programUrl;
  const selectedProgramLabel = programOptions.find((p) => p.value === program)?.label ?? null;

  const requirements = useMemo(() => {
    const schedules =
      schedulesByTerm.get(term ?? "") ??
      schedulesByTerm.values().next().value ??
      ({ termId: term ?? "0", schedules: [] } satisfies SchedulesData);
    return computePersonalizeRequirements({
      catalogue: bundle.catalogue,
      schedules,
      disciplines: { disciplines: bundle.disciplines, faculties: bundle.faculties },
      programUrl: program,
      completedCourses: completed.codes,
      selections: requirementSelections,
    });
  }, [bundle, schedulesByTerm, term, program, completed.codes, requirementSelections]);

  useEffect(() => {
    if (!program) {
      setActiveScheduleRequirementContext(null);
      return;
    }
    setActiveScheduleRequirementContext({
      programUrl: program,
      completedCourses: completed.codes,
      selections: requirementSelections,
    });
  }, [program, completed.codes, requirementSelections]);

  const unassignedCount = requirements?.unassignedCompletedCourses.length ?? 0;
  const requirementsTitle = !program
    ? "Pick a program first"
    : !requirements || unassignedCount === 0
      ? "Ready to generate"
      : `${unassignedCount} course${unassignedCount === 1 ? "" : "s"} to assign`;
  const programOptionRoots = requirements?.requirementTreeWithStatus ?? [];
  const showProgramOptions = programHasOptionGroups(programOptionRoots);
  const missingProgramOptions = hasMissingProgramOptions(
    programOptionRoots,
    requirementSelections.selectedOptionsPerRequirement,
  );
  const canGenerate = requirements == null || (unassignedCount === 0 && !missingProgramOptions);

  const goToSchedule = () => {
    analytics.capture("requirements_viewed", {
      programId: program ?? undefined,
      autoAssignedCount: requirements?.autoAssignedCount,
      unassignedCount,
    });
    setActiveScheduleRequirementContext(
      program
        ? {
            programUrl: program,
            completedCourses: completed.codes,
            selections: requirementSelections,
          }
        : null,
    );
    router.navigate("/schedule");
  };

  const updateCompletedCourses = (nextCodes: string[]) => {
    completed.set(nextCodes);
    analytics.capture("completed_courses_updated", { count: nextCodes.length, source: "manual" });
  };

  // Transcript import (on-device): the document picker hands us a PDF, which we
  // pass as base64 to the hidden `'use dom'` WebView extractor. The extracted
  // pages flow back through `handleTranscriptResult`, where the shared core
  // helpers map them onto the same program / start-year / completed-course state
  // the web ProgramStep populates.
  const handleTranscriptPick = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.canceled || !result.assets[0]) return;
      analytics.capture("transcript_upload_started");
      setTranscriptLoading(true);
      setTranscriptSummary(null);
      const base64 = await new File(result.assets[0].uri).base64();
      setPdfBase64(base64);
    } catch (error) {
      setTranscriptLoading(false);
      setPdfBase64(null);
      analytics.capture("transcript_imported", { ok: false });
      Alert.alert(
        "Couldn't read transcript",
        error instanceof Error ? error.message : "Please choose a different PDF and try again.",
      );
    }
  }, [analytics]);

  const handleTranscriptResult = useCallback(
    async (pages: PdfPageText[]) => {
      const parsed = processExtractedPages(pages);

      const inCatalogue = parsed.courses.filter(
        (code) => isOptCourse(normalizeCourseCode(code)) || coursesByCode.has(code),
      );
      const alreadySelected = new Set(completed.codes);
      let addedCount = 0;
      for (const code of inCatalogue) {
        if (!alreadySelected.has(code)) {
          completed.add(code);
          alreadySelected.add(code);
          addedCount += 1;
        }
      }

      const nextStartYear = parsed.startingYear !== null ? String(parsed.startingYear) : null;
      if (parsed.startingYear !== null) {
        setPersonalization({ startYear: nextStartYear });
      }

      const { program: matched } = findBestMatchingProgram(parsed.fullText, index.programs);
      if (matched) {
        setPersonalization({ programUrl: matched.url });
        setRequirementSelections(DEFAULT_REQUIREMENT_SELECTIONS);
      }
      setPdfBase64(null);
      setTranscriptLoading(false);
      setTranscriptSummary({
        courseCount: addedCount,
        startYear: nextStartYear,
        programTitle: matched?.title ?? null,
      });
      analytics.capture("transcript_imported", {
        ok: true,
        courseCount: addedCount,
        programMatched: matched != null,
        termMatched: parsed.startingYear !== null,
      });
    },
    [analytics, completed, coursesByCode, index.programs, setPersonalization],
  );

  const handleTranscriptError = useCallback(
    async (message: string) => {
      setPdfBase64(null);
      setTranscriptLoading(false);
      analytics.capture("transcript_imported", { ok: false });
      Alert.alert(
        "Couldn't read transcript",
        message || "Please choose a different PDF and try again.",
      );
    },
    [analytics],
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <PagedStepper
        steps={[
          {
            key: "term",
            title: "Choose a term",
            description: "Start with the semester you want to plan.",
            content: (
              <TermStep
                options={termOptions}
                value={term}
                onChange={(termId) => {
                  setPersonalization({ termId });
                  if (termId)
                    analytics.capture("term_selected", {
                      termId,
                      termName: formatTermNameEn(termId),
                    });
                }}
                reminders={<NotificationToggle />}
              />
            ),
          },
          {
            key: "transcript",
            title: "Upload transcript",
            description: "Skip this if you prefer to enter courses manually.",
            content: (
              <TranscriptStep
                pdfBase64={pdfBase64}
                loading={transcriptLoading}
                summary={transcriptSummary}
                onPick={() => void handleTranscriptPick()}
                onResult={handleTranscriptResult}
                onError={handleTranscriptError}
              />
            ),
          },
          {
            key: "options",
            title: "Program & courses",
            description: "Review your year, program, and completed courses.",
            content: (
              <OptionsStep
                startYearOptions={startYearOptions}
                programOptions={programOptions}
                courseOptions={courseOptions}
                coursesByCode={coursesByCode}
                startYear={startYear}
                program={program}
                selectedProgramLabel={selectedProgramLabel}
                courseCodes={completed.codes}
                transcriptSummary={transcriptSummary}
                onStartYearChange={(nextStartYear) => {
                  setPersonalization({ startYear: nextStartYear });
                  analytics.capture("preferences_updated", { field: "start_year" });
                }}
                onProgramChange={(programUrl) => {
                  setPersonalization({ programUrl });
                  setRequirementSelections(DEFAULT_REQUIREMENT_SELECTIONS);
                  if (programUrl) analytics.capture("program_selected", { programId: programUrl });
                }}
                onCourseCodesChange={updateCompletedCourses}
                onRemoveCourse={completed.remove}
              />
            ),
          },
          ...(showProgramOptions
            ? [
                {
                  key: "program-options",
                  title: "Program options",
                  description: "Pick the path that matches your plan.",
                  content: (
                    <ProgramOptionsStep
                      program={program}
                      readout={requirements ?? null}
                      selections={requirementSelections}
                      onChange={setRequirementSelections}
                    />
                  ),
                } satisfies PagedStep,
              ]
            : []),
          {
            key: "requirements",
            title: "Fill requirements",
            description: requirementsTitle,
            content: (
              <RequirementsStep
                program={program}
                readout={requirements ?? null}
                selections={requirementSelections}
                titleForCourse={(code) => coursesByCode.get(code)?.title}
                onChange={setRequirementSelections}
                generateLabel="Show me my schedule"
                canGenerate={canGenerate}
                onGenerate={goToSchedule}
              />
            ),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Surface.page,
  },
});

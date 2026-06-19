import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { Button, Text } from "@uoplan/ui";
import type { SchedulesData } from "@uoplan/core/dataTypes";
import { isOptCourse, normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { AppIcon } from "@/components/app-icon";
import { NotificationToggle } from "@/components/notification-toggle";
import { RequirementPlanner } from "@/components/personalize/requirement-planner";
import { PillButton } from "@/components/redesign/pill-button";
import { RedesignScreen, ScreenHeader, StepCard, type StepStatus } from "@/components/redesign";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/searchable-select";
import { Spacing, Surface } from "@/constants/theme";
import { useBasket } from "@/data/basket-provider";
import { useAppData, useExploreIndex } from "@/data/data-provider";
import type { ExploreProgramEntry } from "@/data/explore-index";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import TranscriptExtractor from "@/lib/transcript-extractor.dom";
import { findBestMatchingProgram, processExtractedPages } from "@/lib/parseTranscriptNative";
import type { PdfPageText } from "@/lib/parseTranscriptNative";
import {
  computePersonalizeRequirements,
  DEFAULT_REQUIREMENT_SELECTIONS,
  setActiveScheduleRequirementContext,
  type PersonalizeRequirementSelections,
} from "@/lib/personalize-requirements";

const UOZONE = "https://uozone2.uottawa.ca/";

type Step = "program" | "requirements" | null;

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
 * Personalize wizard — the native analogue of the web /personalize page: a
 * step-accordion (Term → Program & courses → Fill requirements) with status
 * icons + an active-step accent bar, term/year/program selects, transcript
 * actions, a reminders toggle, and Reset / Generate. Mirrors the web mobile
 * layout. This is its own bottom-tab root; Generate switches to the Schedule
 * tab, where the native engine builds timetables from the persisted basket.
 * Transcript import opens the web flow until on-device parsing ships.
 */
export default function PersonalizeScreen() {
  const router = useRouter();
  const { bundle, schedulesByTerm, catalogueYears } = useAppData();
  const index = useExploreIndex();
  const basket = useBasket();
  const { personalization, setPersonalization, resetPersonalization } = useScheduleOptions();
  const [openStep, setOpenStep] = useState<Step>("program");
  const [requirementSelections, setRequirementSelections] =
    useState<PersonalizeRequirementSelections>(DEFAULT_REQUIREMENT_SELECTIONS);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

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
  const ready = [term, program, basket.codes.length > 0 ? "courses" : null].filter(Boolean).length;

  const toggle = (step: Step) => setOpenStep((current) => (current === step ? null : step));

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
      completedCourses: basket.codes,
      selections: requirementSelections,
    });
  }, [bundle, schedulesByTerm, term, program, basket.codes, requirementSelections]);

  useEffect(() => {
    if (!program) {
      setActiveScheduleRequirementContext(null);
      return;
    }
    setActiveScheduleRequirementContext({
      programUrl: program,
      completedCourses: basket.codes,
      selections: requirementSelections,
    });
  }, [program, basket.codes, requirementSelections]);

  const programStatus: StepStatus = program ? "done" : "active";
  const requirementsStatus: StepStatus = !program
    ? "pending"
    : requirements && requirements.remainingCount === 0
      ? "done"
      : "active";
  const requirementsTitle = !program
    ? "Pick a program first"
    : !requirements
      ? "Ready to generate"
      : requirements.remainingCount === 0
        ? "All requirements met"
        : `${requirements.remainingCount} requirement${requirements.remainingCount === 1 ? "" : "s"} remaining`;

  const goToSchedule = () => {
    setActiveScheduleRequirementContext(
      program
        ? {
            programUrl: program,
            completedCourses: basket.codes,
            selections: requirementSelections,
          }
        : null,
    );
    router.navigate("/schedule");
  };

  const updateBasketCourses = (nextCodes: string[]) => {
    const next = new Set(nextCodes);
    for (const code of basket.codes) {
      if (!next.has(code)) basket.remove(code);
    }
    for (const code of nextCodes) {
      if (!basket.codes.includes(code)) basket.add(code);
    }
  };

  const reset = () => {
    resetPersonalization();
    setRequirementSelections(DEFAULT_REQUIREMENT_SELECTIONS);
    setActiveScheduleRequirementContext(null);
    basket.clear();
    setOpenStep("program");
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
      setTranscriptLoading(true);
      const base64 = await new File(result.assets[0].uri).base64();
      setPdfBase64(base64);
    } catch (error) {
      setTranscriptLoading(false);
      setPdfBase64(null);
      Alert.alert(
        "Couldn't read transcript",
        error instanceof Error ? error.message : "Please choose a different PDF and try again.",
      );
    }
  }, []);

  const handleTranscriptResult = useCallback(
    async (pages: PdfPageText[]) => {
      const parsed = processExtractedPages(pages);

      const inCatalogue = parsed.courses.filter(
        (code) => isOptCourse(normalizeCourseCode(code)) || coursesByCode.has(code),
      );
      for (const code of inCatalogue) {
        if (!basket.codes.includes(code)) basket.add(code);
      }

      if (parsed.startingYear !== null) {
        setPersonalization({ startYear: String(parsed.startingYear) });
      }

      const { program: matched } = findBestMatchingProgram(parsed.fullText, index.programs);
      if (matched) {
        setPersonalization({ programUrl: matched.url });
        setRequirementSelections(DEFAULT_REQUIREMENT_SELECTIONS);
      }

      setPdfBase64(null);
      setTranscriptLoading(false);
      Alert.alert(
        "Transcript imported",
        matched
          ? `Added ${inCatalogue.length} course${inCatalogue.length === 1 ? "" : "s"} and matched ${matched.title}.`
          : `Added ${inCatalogue.length} course${inCatalogue.length === 1 ? "" : "s"}. Pick your program manually if it wasn't detected.`,
      );
    },
    [basket, coursesByCode, index.programs, setPersonalization],
  );

  const handleTranscriptError = useCallback(async (message: string) => {
    setPdfBase64(null);
    setTranscriptLoading(false);
    Alert.alert(
      "Couldn't read transcript",
      message || "Please choose a different PDF and try again.",
    );
  }, []);

  return (
    <RedesignScreen gap={Spacing.three}>
      <ScreenHeader title="Personalize your plan" subtitle={`${ready} of 3 inputs ready`} />

      <NotificationToggle />

      <StepCard
        stepLabel="Term"
        title={termOptions.find((t) => t.value === term)?.label ?? "Select a term"}
        status={term ? "done" : "active"}
        expanded={openStep === null}
        onToggle={() => toggle(null)}
      >
        <SearchableSelect
          title="Term"
          options={termOptions}
          value={term}
          onChange={(termId) => setPersonalization({ termId })}
          placeholder="Select your term…"
          searchPlaceholder="Search terms"
          emptyMessage="No terms match your search."
          clearable={false}
        />
      </StepCard>

      <StepCard
        stepLabel="Program & courses"
        title={selectedProgramLabel ?? "Program not selected"}
        status={programStatus}
        expanded={openStep === "program"}
        onToggle={() => toggle("program")}
      >
        <View style={styles.field}>
          <Text size="md" weight="bold">
            First year of study
          </Text>
          <Text size="sm" dimmed>
            Determines which program requirements apply to you.
          </Text>
          <SearchableSelect
            title="First year of study"
            options={startYearOptions}
            value={startYear}
            onChange={(nextStartYear) => setPersonalization({ startYear: nextStartYear })}
            placeholder="Select your starting year…"
            searchPlaceholder="Search years"
            emptyMessage="No start years are available for this data set."
          />
        </View>

        <View style={styles.field}>
          <Text size="md" weight="bold">
            Select your program
          </Text>
          <SearchableSelect
            title="Program"
            options={programOptions}
            value={program}
            onChange={(programUrl) => {
              setPersonalization({ programUrl });
              setRequirementSelections(DEFAULT_REQUIREMENT_SELECTIONS);
            }}
            placeholder="Search for your program…"
            searchPlaceholder="Search programs"
            emptyMessage="No programs match your search."
          />
        </View>

        <View style={styles.field}>
          <Text size="md" weight="bold">
            Completed courses
          </Text>
          <Text size="sm" dimmed>
            Select courses from the real catalogue. They are saved to your basket for schedule
            generation.
          </Text>
          <SearchableMultiSelect
            title="Completed courses"
            options={courseOptions}
            values={basket.codes}
            onChange={updateBasketCourses}
            placeholder="Search for completed courses…"
            searchPlaceholder="Search by course code or title"
            emptyMessage="No courses match your search."
          />
          {basket.codes.length > 0 ? (
            <View style={styles.courseChips}>
              {basket.codes.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${code}`}
                  onPress={() => basket.remove(code)}
                  style={styles.courseChip}
                >
                  <View style={styles.courseChipCopy}>
                    <Text size="xs" weight="bold" color={Surface.accent}>
                      {code}
                    </Text>
                    <Text size="xs" dimmed numberOfLines={1}>
                      {coursesByCode.get(code)?.title ?? "Selected course"}
                    </Text>
                  </View>
                  <AppIcon name="xmark" size={12} color={Surface.dimmed} weight="semibold" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Button
          variant="default"
          onPress={() => void handleTranscriptPick()}
          disabled={transcriptLoading}
        >
          {transcriptLoading ? "Parsing transcript…" : "Choose transcript"}
        </Button>
        <TranscriptExtractor
          dom={{ matchContents: true }}
          pdfBase64={pdfBase64}
          onResult={handleTranscriptResult}
          onError={handleTranscriptError}
        />
        <Pressable
          onPress={() => void Linking.openURL(UOZONE)}
          accessibilityRole="link"
          style={styles.uozone}
        >
          <Text size="sm" weight="bold">
            Request transcript on uoZone
          </Text>
          <AppIcon name="arrow.up.right" size={13} color={Surface.label} />
        </Pressable>
      </StepCard>

      <StepCard
        stepLabel="Fill requirements"
        title={requirementsTitle}
        status={requirementsStatus}
        expanded={openStep === "requirements" && program != null}
        onToggle={() => (program ? toggle("requirements") : undefined)}
        disabled={!program}
      >
        {requirements ? (
          <View style={styles.field}>
            <RequirementPlanner
              readout={requirements}
              selections={requirementSelections}
              completedCourses={basket.codes}
              titleForCourse={(code) => coursesByCode.get(code)?.title}
              onChange={setRequirementSelections}
            />
          </View>
        ) : (
          <Text size="sm" dimmed>
            Pick a program above to see which requirements your completed courses satisfy.
          </Text>
        )}
      </StepCard>

      <View style={styles.actions}>
        <PillButton label="Generate" variant="primary" onPress={goToSchedule} />
        <PillButton label="Reset" variant="destructive" onPress={reset} />
      </View>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  courseChips: {
    gap: Spacing.one,
  },
  courseChip: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  courseChipCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  uozone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
  },
});

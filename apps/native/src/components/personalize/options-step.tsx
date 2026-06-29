import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { CompletedCoursesSheet } from "@/components/personalize/completed-courses-sheet";
import { usePagedStepperContentInset } from "@/components/paged-stepper";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/searchable-select";
import type { TranscriptImportSummary } from "@/components/personalize/transcript-step";
import type { ExploreCourseEntry } from "@/data/explore-index";
import { Fonts, Spacing, Surface } from "@/constants/theme";

interface OptionsStepProps {
  startYearOptions: SearchableSelectOption[];
  programOptions: SearchableSelectOption[];
  courseOptions: SearchableSelectOption[];
  coursesByCode: ReadonlyMap<string, ExploreCourseEntry>;
  startYear: string | null;
  program: string | null;
  selectedProgramLabel: string | null;
  courseCodes: string[];
  transcriptSummary: TranscriptImportSummary | null;
  onStartYearChange: (startYear: string | null) => void;
  onProgramChange: (programUrl: string | null) => void;
  onCourseCodesChange: (codes: string[]) => void;
  onRemoveCourse: (code: string) => void;
}

export function OptionsStep({
  startYearOptions,
  programOptions,
  courseOptions,
  coursesByCode,
  startYear,
  program,
  selectedProgramLabel,
  courseCodes,
  transcriptSummary,
  onStartYearChange,
  onProgramChange,
  onCourseCodesChange,
  onRemoveCourse,
}: OptionsStepProps) {
  const contentInset = usePagedStepperContentInset();
  const transcriptResolvedEssentials = Boolean(transcriptSummary && startYear && program);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const completedCourses = courseCodes.map((code) => ({
    code,
    title: coursesByCode.get(code)?.title ?? "Selected course",
  }));
  const summaryFacts = [
    {
      key: "year",
      label: startYear ? "Start year ready" : "Start year needed",
      ready: !!startYear,
    },
    {
      key: "program",
      label: selectedProgramLabel ? "Program ready" : "Program needed",
      ready: !!selectedProgramLabel,
    },
    {
      key: "courses",
      label: `${courseCodes.length} course${courseCodes.length === 1 ? "" : "s"} selected`,
      ready: courseCodes.length > 0,
    },
  ];

  return (
    <View style={[styles.root, { paddingBottom: contentInset }]}>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {transcriptResolvedEssentials ? "Confirm your details" : "Fill the missing details"}
        </Text>
        <Text style={styles.summaryCopy}>
          {transcriptResolvedEssentials
            ? "Your transcript filled the essentials. Everything below stays editable."
            : "Choose anything the transcript did not detect, or complete this step manually."}
        </Text>
        <View style={styles.summaryFacts}>
          {summaryFacts.map((fact) => (
            <View
              key={fact.key}
              style={[styles.factChip, fact.ready ? styles.factChipReady : styles.factChipPending]}
            >
              <AppIcon
                name={fact.ready ? "checkmark.circle.fill" : "exclamationmark.circle"}
                size={12}
                color={fact.ready ? Surface.accent : Surface.dimmed}
                weight="semibold"
              />
              <Text
                style={[styles.fact, fact.ready ? styles.factReady : styles.factPending]}
                numberOfLines={1}
              >
                {fact.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>First year of study</Text>
        <SearchableSelect
          title="First year of study"
          options={startYearOptions}
          value={startYear}
          onChange={onStartYearChange}
          placeholder="Select your starting year…"
          searchPlaceholder="Search years"
          emptyMessage="No start years are available for this data set."
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Select your program</Text>
        <SearchableSelect
          title="Program"
          options={programOptions}
          value={program}
          onChange={onProgramChange}
          placeholder="Search for your program…"
          searchPlaceholder="Search programs"
          emptyMessage="No programs match your search."
          searchOnly
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Completed courses</Text>
        <SearchableMultiSelect
          title="Completed courses"
          options={courseOptions}
          values={courseCodes}
          onChange={onCourseCodesChange}
          placeholder="Search for completed courses…"
          searchPlaceholder="Search by course code or title"
          emptyMessage="No courses match your search."
          searchOnly
        />
        {courseCodes.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage completed courses"
            onPress={() => setCoursesOpen(true)}
            style={({ pressed }) => [styles.manageButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.manageLabel}>
              {courseCodes.length} completed course{courseCodes.length === 1 ? "" : "s"}
            </Text>
            <View style={styles.manageMeta}>
              <Text style={styles.manageAction}>Manage</Text>
              <AppIcon name="chevron.right" size={12} color={Surface.dimmed} weight="semibold" />
            </View>
          </Pressable>
        ) : null}
      </View>

      <CompletedCoursesSheet
        open={coursesOpen}
        courses={completedCourses}
        onRemove={onRemoveCourse}
        onClose={() => setCoursesOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  summary: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 22,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  summaryTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Surface.label,
  },
  summaryCopy: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Surface.dimmed,
  },
  summaryFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  factChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  factChipReady: {
    borderColor: Surface.accentSoft,
    backgroundColor: Surface.accentSoft,
  },
  factChipPending: {
    borderColor: Surface.border,
    backgroundColor: Surface.subtle,
  },
  fact: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
  },
  factReady: {
    color: Surface.accent,
  },
  factPending: {
    color: Surface.dimmed,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    fontFamily: Fonts.monoMedium,
    fontSize: 15,
    fontWeight: "700",
    color: Surface.label,
  },
  manageButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  manageLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
  },
  manageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  manageAction: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.accent,
  },
  pressed: {
    opacity: 0.82,
  },
});

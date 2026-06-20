import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

import { AppIcon } from "@/components/app-icon";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/searchable-select";
import type { TranscriptImportSummary } from "@/components/personalize/transcript-step";
import type { ExploreCourseEntry } from "@/data/explore-index";
import { Fonts, Spacing, Surface } from "@/constants/theme";

// LayoutAnimation needs an opt-in on old-architecture Android; under Fabric the
// setter is a no-op that warns, so guard on the architecture.
const IS_FABRIC = Boolean(
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager,
);
if (Platform.OS === "android" && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

function CourseChip({
  code,
  title,
  onRemove,
}: {
  code: string;
  title: string;
  onRemove: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${code}`}
      onPress={onRemove}
      style={({ pressed }) => [styles.courseChip, pressed ? styles.pressed : null]}
    >
      <View style={styles.courseChipCopy}>
        <Text style={styles.courseCode}>{code}</Text>
        <Text style={styles.courseTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <AppIcon name="xmark" size={12} color={Surface.dimmed} weight="semibold" />
    </Pressable>
  );
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
  const transcriptResolvedEssentials = Boolean(transcriptSummary && startYear && program);
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const toggleCourses = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCoursesExpanded((value) => !value);
  };

  return (
    <View style={styles.root}>
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
          <Text style={styles.fact}>{startYear ? "Start year ready" : "Start year needed"}</Text>
          <Text style={styles.fact}>
            {selectedProgramLabel ? "Program ready" : "Program needed"}
          </Text>
          <Text style={styles.fact}>
            {courseCodes.length} course{courseCodes.length === 1 ? "" : "s"} selected
          </Text>
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
        />
        {courseCodes.length > 0 ? (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: coursesExpanded }}
              accessibilityLabel={`${coursesExpanded ? "Hide" : "Show"} completed courses`}
              onPress={toggleCourses}
              style={({ pressed }) => [styles.disclosure, pressed ? styles.pressed : null]}
            >
              <Text style={styles.disclosureLabel}>
                {courseCodes.length} completed course{courseCodes.length === 1 ? "" : "s"}
              </Text>
              <AppIcon
                name={coursesExpanded ? "chevron.down" : "chevron.right"}
                size={12}
                color={Surface.dimmed}
                weight="semibold"
              />
            </Pressable>
            {coursesExpanded ? (
              <ScrollView
                style={styles.courseScroll}
                contentContainerStyle={styles.courseChips}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {courseCodes.map((code) => (
                  <CourseChip
                    key={code}
                    code={code}
                    title={coursesByCode.get(code)?.title ?? "Selected course"}
                    onRemove={() => onRemoveCourse(code)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>
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
    gap: Spacing.one,
  },
  fact: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.accent,
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
  courseChips: {
    gap: Spacing.one,
  },
  disclosure: {
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
  disclosureLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
  },
  courseScroll: {
    maxHeight: 196,
    marginTop: Spacing.one,
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
  pressed: {
    opacity: 0.82,
  },
  courseChipCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  courseCode: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.accent,
  },
  courseTitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Surface.dimmed,
  },
});

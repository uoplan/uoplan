import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { PillButton } from "@/components/redesign/pill-button";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import type {
  ExploreFilterDifficulty,
  ExploreCourseLanguage,
  ExploreCourseLevel,
  ExploreSearchFilters,
  ExploreSortDir,
  ExploreSortKey,
} from "@/data/explore-index";
import { SORT_DEFAULT_DIR } from "@/data/explore-index";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";

export type ExploreFilterKey =
  | "level"
  | "language"
  | "discipline"
  | "difficulty"
  | "rating"
  | "feedback"
  | "term"
  | "requirements"
  | "sort";

const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.82;

export interface ExploreFilterState {
  levels: ExploreCourseLevel[];
  languages: ExploreCourseLanguage[];
  disciplines: string[];
  difficulty: ExploreFilterDifficulty | null;
  minRating: number | null;
  minFeedback: number | null;
  termId: string | null;
  contributesToRequirements: boolean;
  sortKey: ExploreSortKey;
  sortDir: ExploreSortDir;
}

export interface ExploreFilterOption<Value extends string | number> {
  value: Value;
  label: string;
  helper?: string;
}

interface ExploreFiltersDrawerProps {
  opened: boolean;
  activeFilter: ExploreFilterKey | null;
  filters: ExploreFilterState;
  levelOptions: ExploreFilterOption<ExploreCourseLevel>[];
  languageOptions: ExploreFilterOption<ExploreCourseLanguage>[];
  disciplineOptions: ExploreFilterOption<string>[];
  difficultyOptions: ExploreFilterOption<ExploreFilterDifficulty>[];
  ratingOptions: ExploreFilterOption<number>[];
  feedbackOptions: ExploreFilterOption<number>[];
  termOptions: ExploreFilterOption<string>[];
  requirementsAvailable: boolean;
  onApply: (filters: ExploreSearchFilters) => void;
  onClose: () => void;
}

const FILTER_TITLES: Record<ExploreFilterKey, string> = {
  level: "Course level",
  language: "Language",
  discipline: "Discipline",
  difficulty: "Difficulty",
  rating: "Professor rating",
  feedback: "Student feedback",
  term: "Term",
  requirements: "Requirements",
  sort: "Sort",
};

const SORT_OPTIONS: ExploreFilterOption<ExploreSortKey>[] = [
  { value: "relevance", label: "Relevance", helper: "Keep search order" },
  { value: "grade", label: "Average grade", helper: "Courses only" },
  { value: "code", label: "Course code", helper: "Courses only" },
  { value: "rating", label: "Professor rating", helper: "Professors only" },
  { value: "feedback", label: "Student feedback", helper: "Courses and professors" },
];

const SORT_DIR_OPTIONS: ExploreFilterOption<ExploreSortDir>[] = [
  { value: "desc", label: "Descending", helper: "Highest first" },
  { value: "asc", label: "Ascending", helper: "Lowest first" },
];

function cloneFilters(filters: ExploreFilterState): ExploreFilterState {
  return {
    levels: [...filters.levels],
    languages: [...filters.languages],
    disciplines: [...filters.disciplines],
    difficulty: filters.difficulty,
    minRating: filters.minRating,
    minFeedback: filters.minFeedback,
    termId: filters.termId,
    contributesToRequirements: filters.contributesToRequirements,
    sortKey: filters.sortKey,
    sortDir: filters.sortDir,
  };
}

function toggleValue<Value>(values: readonly Value[], value: Value): Value[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function clearSection(filters: ExploreFilterState, section: ExploreFilterKey): ExploreFilterState {
  if (section === "level") return { ...filters, levels: [] };
  if (section === "language") return { ...filters, languages: [] };
  if (section === "discipline") return { ...filters, disciplines: [] };
  if (section === "difficulty") return { ...filters, difficulty: null };
  if (section === "rating") return { ...filters, minRating: null };
  if (section === "feedback") return { ...filters, minFeedback: null };
  if (section === "term") return { ...filters, termId: null };
  if (section === "requirements") return { ...filters, contributesToRequirements: false };
  return { ...filters, sortKey: "relevance", sortDir: SORT_DEFAULT_DIR.relevance };
}

function sectionCount(filters: ExploreFilterState, section: ExploreFilterKey): number {
  if (section === "level") return filters.levels.length;
  if (section === "language") return filters.languages.length;
  if (section === "discipline") return filters.disciplines.length;
  if (section === "difficulty") return filters.difficulty === null ? 0 : 1;
  if (section === "rating") return filters.minRating === null ? 0 : 1;
  if (section === "feedback") return filters.minFeedback === null ? 0 : 1;
  if (section === "term") return filters.termId === null ? 0 : 1;
  if (section === "requirements") return filters.contributesToRequirements ? 1 : 0;
  return filters.sortKey === "relevance" && filters.sortDir === SORT_DEFAULT_DIR.relevance ? 0 : 1;
}

/** Show an inline search box once a filter section has more options than this. */
const SEARCH_THRESHOLD = 12;

function optionMatches(
  option: { label: string; helper?: string; value: string | number },
  needle: string,
): boolean {
  if (!needle) return true;
  return `${option.label} ${option.helper ?? ""} ${option.value}`.toLowerCase().includes(needle);
}

function OptionRow({
  label,
  helper,
  selected,
  role = "checkbox",
  onPress,
}: {
  label: string;
  helper?: string;
  selected: boolean;
  role?: "checkbox" | "radio" | "switch";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed ? styles.optionPressed : null,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text size="sm" weight={selected ? "semibold" : "regular"} color={Surface.label}>
          {label}
        </Text>
        {helper ? (
          <Text size="xs" dimmed numberOfLines={1}>
            {helper}
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, selected ? styles.checkSelected : null]}>
        {selected ? (
          <AppIcon name="checkmark" size={13} color={Surface.onAccent} weight="semibold" />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Native Explore filter sheet. It intentionally mirrors the existing drawer
 * motion: RN Modal with no built-in animation, fading backdrop opacity, and a
 * separate sheet translateY slide.
 */
export function ExploreFiltersDrawer({
  opened,
  activeFilter,
  filters,
  levelOptions,
  languageOptions,
  disciplineOptions,
  difficultyOptions,
  ratingOptions,
  feedbackOptions,
  termOptions,
  requirementsAvailable,
  onApply,
  onClose,
}: ExploreFiltersDrawerProps) {
  const { width, height, formSheet } = useAdaptiveLayout();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(opened);
  const [draft, setDraftState] = useState<ExploreFilterState>(() => cloneFilters(filters));
  const draftRef = useRef(draft);
  const wasOpened = useRef(opened);
  const [query, setQuery] = useState("");
  // Keep showing the last opened section while the sheet animates out: the parent
  // clears `activeFilter` to null on close, so reading it directly here would flip
  // the still-visible sheet back to the "level" fallback mid-slide (a flash).
  const [section, setSection] = useState<ExploreFilterKey>(activeFilter ?? "level");

  const setDraft = (
    update: ExploreFilterState | ((current: ExploreFilterState) => ExploreFilterState),
  ) => {
    setDraftState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      draftRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (activeFilter) setSection(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    if (opened && !wasOpened.current) setDraft(cloneFilters(filters));
    wasOpened.current = opened;
  }, [opened, filters]);

  useEffect(() => {
    setQuery("");
  }, [opened, activeFilter]);

  useEffect(() => {
    if (opened) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [opened, mounted, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const formSheetWidth = Math.max(0, Math.min(FORM_SHEET_MAX_WIDTH, width - FORM_SHEET_MARGIN * 2));
  const formSheetMaxHeight = Math.max(
    0,
    Math.min(height * FORM_SHEET_MAX_HEIGHT_RATIO, height - FORM_SHEET_MARGIN * 2),
  );
  const selectedCount = sectionCount(draft, section);
  const canClear = selectedCount > 0;

  const applyAndClose = () => {
    onApply(cloneFilters(draftRef.current));
    onClose();
  };

  const renderSingleOptions = <Value extends string | number>(
    options: ExploreFilterOption<Value>[],
    selected: Value | null,
    update: (value: Value | null) => void,
  ) =>
    options
      .filter((option) => optionMatches(option, query.trim().toLowerCase()))
      .map((option) => (
        <OptionRow
          key={option.value}
          label={option.label}
          helper={option.helper}
          selected={selected === option.value}
          role="radio"
          onPress={() => update(selected === option.value ? null : option.value)}
        />
      ));

  const renderOptions = () => {
    const needle = query.trim().toLowerCase();
    if (section === "level") {
      return levelOptions
        .filter((option) => optionMatches(option, needle))
        .map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={draft.levels.includes(option.value)}
            onPress={() =>
              setDraft((current) => ({
                ...current,
                levels: toggleValue(current.levels, option.value),
              }))
            }
          />
        ));
    }

    if (section === "language") {
      return languageOptions
        .filter((option) => optionMatches(option, needle))
        .map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={draft.languages.includes(option.value)}
            onPress={() =>
              setDraft((current) => ({
                ...current,
                languages: toggleValue(current.languages, option.value),
              }))
            }
          />
        ));
    }

    if (section === "discipline") {
      return disciplineOptions
        .filter((option) => optionMatches(option, needle))
        .map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={draft.disciplines.includes(option.value)}
            onPress={() =>
              setDraft((current) => ({
                ...current,
                disciplines: toggleValue(current.disciplines, option.value),
              }))
            }
          />
        ));
    }

    if (section === "difficulty") {
      return renderSingleOptions(difficultyOptions, draft.difficulty, (difficulty) =>
        setDraft((current) => ({ ...current, difficulty })),
      );
    }

    if (section === "rating") {
      return renderSingleOptions(ratingOptions, draft.minRating, (minRating) =>
        setDraft((current) => ({ ...current, minRating })),
      );
    }

    if (section === "feedback") {
      return renderSingleOptions(feedbackOptions, draft.minFeedback, (minFeedback) =>
        setDraft((current) => ({ ...current, minFeedback })),
      );
    }

    if (section === "term") {
      return renderSingleOptions(termOptions, draft.termId, (termId) =>
        setDraft((current) => ({ ...current, termId })),
      );
    }

    if (section === "requirements") {
      return requirementsAvailable
        ? [
            <OptionRow
              key="requirements"
              label="Fits my requirements"
              helper="Courses that can satisfy your remaining selected program requirements"
              selected={draft.contributesToRequirements}
              role="switch"
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  contributesToRequirements: !current.contributesToRequirements,
                }))
              }
            />,
          ]
        : [];
    }

    return [
      <View key="sort-key" style={styles.optionGroup}>
        <Text size="xs" weight="bold" color={Surface.dimmed}>
          SORT BY
        </Text>
        {SORT_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={draft.sortKey === option.value}
            role="radio"
            onPress={() =>
              setDraft((current) => ({
                ...current,
                sortKey: option.value,
                sortDir: SORT_DEFAULT_DIR[option.value],
              }))
            }
          />
        ))}
      </View>,
      <View key="sort-dir" style={styles.optionGroup}>
        <Text size="xs" weight="bold" color={Surface.dimmed}>
          DIRECTION
        </Text>
        {SORT_DIR_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={draft.sortDir === option.value}
            role="radio"
            onPress={() => setDraft((current) => ({ ...current, sortDir: option.value }))}
          />
        ))}
      </View>,
    ];
  };

  const optionRows = renderOptions();
  const sourceCount = (() => {
    if (section === "level") return levelOptions.length;
    if (section === "language") return languageOptions.length;
    if (section === "discipline") return disciplineOptions.length;
    if (section === "difficulty") return difficultyOptions.length;
    if (section === "rating") return ratingOptions.length;
    if (section === "feedback") return feedbackOptions.length;
    if (section === "term") return termOptions.length;
    return 0;
  })();
  const showSearch = sourceCount > SEARCH_THRESHOLD;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.root, formSheet ? styles.formSheetRoot : null]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            formSheet
              ? {
                  width: formSheetWidth,
                  maxHeight: formSheetMaxHeight,
                  opacity: progress,
                  transform: [{ scale }],
                }
              : { transform: [{ translateY }] },
            formSheet ? styles.formSheet : null,
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text size="xl" weight="bold" color={Surface.label}>
                {FILTER_TITLES[section]}
              </Text>
              <Text size="xs" dimmed>
                {selectedCount === 0 ? "No options selected" : `${selectedCount} selected`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!canClear}
              onPress={() => setDraft((current) => clearSection(current, section))}
              style={[styles.clearButton, !canClear ? styles.clearButtonDisabled : null]}
            >
              <Text size="sm" color={canClear ? Surface.accent : Surface.faint} weight="semibold">
                Clear
              </Text>
            </Pressable>
          </View>

          {showSearch ? (
            <View style={styles.search}>
              <AppIcon name="magnifyingglass" size={17} color={Surface.dimmed} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${FILTER_TITLES[section].toLowerCase()}`}
                placeholderTextColor={Surface.dimmed}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {optionRows.length > 0 ? (
              optionRows
            ) : (
              <View style={styles.empty}>
                <Text size="sm" dimmed align="center">
                  {section === "requirements" && !requirementsAvailable
                    ? "Pick a program in personalize to use this filter."
                    : query.trim()
                      ? "No options match your search."
                      : "No filter options are available for this data set."}
                </Text>
              </View>
            )}
          </ScrollView>

          <PillButton
            label="Done"
            variant="primary"
            onPress={applyAndClose}
            style={styles.footerButton}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  formSheetRoot: {
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Surface.page,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "82%",
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  formSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Surface.border,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  clearButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  clearButtonDisabled: {
    opacity: 0.55,
  },
  search: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 15,
    color: Surface.label,
    padding: 0,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  optionGroup: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accentSoft,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accent,
  },
  empty: {
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  footerButton: {
    marginTop: Spacing.two,
  },
});

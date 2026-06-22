import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import {
  courseSentimentByNorm,
  disciplineSentiment,
  professorSentimentByName,
} from "@uoplan/core/feedback";
import { normalizeProfessorName } from "@uoplan/core/professorRatings";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { Text } from "@uoplan/ui";

import {
  CourseResultCard,
  DisciplineResultCard,
  FacultyResultCard,
  ProfessorResultCard,
  ProgramResultCard,
} from "@/components/explore-cards";
import { ResponsiveColumns } from "@/components/layout";
import {
  ExploreFiltersDrawer,
  type ExploreFilterKey,
  type ExploreFilterOption,
  type ExploreFilterState,
} from "@/components/explore/explore-filters-drawer";
import {
  BannerPill,
  type ChipOption,
  ChipRow,
  EdgeFadeCarousel,
  RedesignScreen,
  ScreenHeader,
  SearchField,
} from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useAppData, useExploreIndex, useFeedback } from "@/data/data-provider";
import {
  DIFFICULTY_VALUES,
  EXPLORE_COURSE_LEVELS,
  MIN_FEEDBACK_VALUES,
  MIN_RATING_VALUES,
  SORT_DEFAULT_DIR,
  courseSpotlights,
  exploreCourseLanguage,
  exploreCourseLevel,
  type ExploreFilterDifficulty,
  type ExploreCourseLanguage,
  type ExploreCourseLevel,
  type ExploreProgramEntry,
  type ExploreSearchFilters,
  type ExploreSortDir,
  type ExploreSortKey,
  searchExplore,
} from "@/data/explore-index";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import {
  buildRequirementCandidateSet,
  computePersonalizeRequirements,
} from "@/lib/personalize-requirements";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";
import { useAnalytics } from "@/lib/analytics";

const FILTER_KEYS: ExploreFilterKey[] = [
  "level",
  "language",
  "discipline",
  "difficulty",
  "rating",
  "feedback",
  "term",
  "requirements",
  "sort",
];

const LANGUAGE_LABEL: Record<ExploreCourseLanguage, string> = {
  en: "English",
  fr: "French",
};

const DIFFICULTY_LABEL: Record<ExploreFilterDifficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  tough: "Tough",
};

const SORT_LABEL: Record<ExploreSortKey, string> = {
  relevance: "Relevance",
  grade: "Average grade",
  code: "Course code",
  rating: "Professor rating",
  feedback: "Student feedback",
};

const SORT_DIR_LABEL: Record<ExploreSortDir, string> = {
  asc: "ascending",
  desc: "descending",
};

function createEmptyFilters(): ExploreFilterState {
  return {
    levels: [],
    languages: [],
    disciplines: [],
    difficulty: null,
    minRating: null,
    minFeedback: null,
    termId: null,
    contributesToRequirements: false,
    sortKey: "relevance",
    sortDir: SORT_DEFAULT_DIR.relevance,
  };
}

function filterCount(filters: ExploreFilterState, key: ExploreFilterKey): number {
  if (key === "level") return filters.levels.length;
  if (key === "language") return filters.languages.length;
  if (key === "discipline") return filters.disciplines.length;
  if (key === "difficulty") return filters.difficulty === null ? 0 : 1;
  if (key === "rating") return filters.minRating === null ? 0 : 1;
  if (key === "feedback") return filters.minFeedback === null ? 0 : 1;
  if (key === "term") return filters.termId === null ? 0 : 1;
  if (key === "requirements") return filters.contributesToRequirements ? 1 : 0;
  return filters.sortKey === "relevance" && filters.sortDir === SORT_DEFAULT_DIR.relevance ? 0 : 1;
}

function chipLabel(
  key: ExploreFilterKey,
  filters: ExploreFilterState,
  termNameById: Map<string, string>,
): string {
  if (key === "level") {
    if (filters.levels.length === 0) return "Level";
    if (filters.levels.length === 1) return `${filters.levels[0]} level`;
    return `Level (${filters.levels.length})`;
  }
  if (key === "language") {
    if (filters.languages.length === 0) return "Language";
    if (filters.languages.length === 1) return LANGUAGE_LABEL[filters.languages[0]];
    return `Language (${filters.languages.length})`;
  }
  if (key === "discipline") {
    if (filters.disciplines.length === 0) return "Discipline";
    if (filters.disciplines.length === 1) return filters.disciplines[0];
    return `Discipline (${filters.disciplines.length})`;
  }
  if (key === "difficulty") {
    return filters.difficulty === null ? "Difficulty" : DIFFICULTY_LABEL[filters.difficulty];
  }
  if (key === "rating") {
    return filters.minRating === null ? "Rating" : `${filters.minRating}+ rating`;
  }
  if (key === "feedback") {
    return filters.minFeedback === null ? "Feedback" : `${filters.minFeedback}+ feedback`;
  }
  if (key === "term") {
    return filters.termId === null ? "Term" : (termNameById.get(filters.termId) ?? "Term");
  }
  if (key === "requirements") return "Fits requirements";
  if (filters.sortKey === "relevance" && filters.sortDir === SORT_DEFAULT_DIR.relevance) {
    return "Sort";
  }
  return `Sort: ${SORT_LABEL[filters.sortKey]} ${SORT_DIR_LABEL[filters.sortDir]}`;
}

function normalizeFilters(filters: ExploreSearchFilters): ExploreFilterState {
  return {
    levels: [...(filters.levels ?? [])],
    languages: [...(filters.languages ?? [])],
    disciplines: [...(filters.disciplines ?? [])],
    difficulty: filters.difficulty ?? null,
    minRating: filters.minRating ?? null,
    minFeedback: filters.minFeedback ?? null,
    termId: filters.termId == null ? null : String(filters.termId),
    contributesToRequirements: Boolean(filters.contributesToRequirements),
    sortKey: filters.sortKey ?? "relevance",
    sortDir: filters.sortDir ?? SORT_DEFAULT_DIR[filters.sortKey ?? "relevance"],
  };
}

function levelHelper(level: ExploreCourseLevel): string {
  return level === 5000 ? "Graduate courses" : "Undergraduate courses";
}

/** A titled result-card section: compact carousel, regular-width two-column grid. */
function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  const layout = useAdaptiveLayout();
  const useGrid = layout.columns === 2;

  return (
    <View style={styles.section}>
      <Text size="xs" weight="bold" color={Surface.dimmed}>
        {title.toUpperCase()}
      </Text>
      {useGrid ? (
        <ResponsiveColumns gap={Spacing.two}>{children}</ResponsiveColumns>
      ) : (
        <EdgeFadeCarousel gutter={Spacing.three}>{children}</EdgeFadeCarousel>
      )}
    </View>
  );
}

const CARD_WIDTH = 210;
const REGULAR_CARD_WIDTH = 360;

/**
 * Explore tab — search + browse with 1:1 web parity. Searching returns every
 * result type (courses, professors, disciplines, faculties, programs), each card
 * carrying a grade-distribution bar at the bottom. An empty query shows the
 * spotlight course carousels (hardest / highest fail / most graded). Tapping a
 * card pushes its detail screen (course/professor/discipline/faculty); programs
 * open on the web. Real data comes from the app data provider (all `.pb` assets
 * loaded up front).
 */
export default function ExploreScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const layout = useAdaptiveLayout();
  const { bundle, schedulesByTerm } = useAppData();
  const index = useExploreIndex();
  const feedback = useFeedback();
  const completed = useCompletedCourses();
  const { personalization } = useScheduleOptions();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExploreFilterState>(() => createEmptyFilters());
  const [activeDrawerFilter, setActiveDrawerFilter] = useState<ExploreFilterKey | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  const termOptions = useMemo<ExploreFilterOption<string>[]>(
    () =>
      [...bundle.terms]
        .sort((a, b) => String(b.termId).localeCompare(String(a.termId)))
        .map((term) => ({
          value: String(term.termId),
          label: term.name,
          helper: String(term.termId),
        })),
    [bundle.terms],
  );
  const termNameById = useMemo(
    () => new Map(termOptions.map((term) => [term.value, term.label] as const)),
    [termOptions],
  );
  const requirementsAvailable = personalization.programUrl !== null;

  const activeFilterKeys = useMemo(
    () =>
      FILTER_KEYS.filter(
        (key) => filterCount(filters, key) > 0 && (key !== "requirements" || requirementsAvailable),
      ),
    [filters, requirementsAvailable],
  );
  const searching = query.trim().length > 0 || activeFilterKeys.some((key) => key !== "sort");
  const spotlights = useMemo(() => courseSpotlights(index), [index]);
  const levelOptions = useMemo<ExploreFilterOption<ExploreCourseLevel>[]>(() => {
    const available = new Set(
      index.courses
        .map((course) => exploreCourseLevel(course.code))
        .filter((level) => level != null),
    );
    return EXPLORE_COURSE_LEVELS.filter((level) => available.has(level)).map((level) => ({
      value: level,
      label: `${level}-level courses`,
      helper: levelHelper(level),
    }));
  }, [index.courses]);
  const languageOptions = useMemo<ExploreFilterOption<ExploreCourseLanguage>[]>(() => {
    const available = new Set(
      index.courses
        .map((course) => exploreCourseLanguage(course.code))
        .filter((language) => language != null),
    );
    return (["en", "fr"] as const)
      .filter((language) => available.has(language))
      .map((language) => ({
        value: language,
        label: LANGUAGE_LABEL[language],
        helper: "Derived from course code",
      }));
  }, [index.courses]);
  const disciplineOptions = useMemo<ExploreFilterOption<string>[]>(
    () =>
      index.disciplines
        .filter((discipline) => discipline.courseCount > 0)
        .map((discipline) => ({
          value: discipline.code.toUpperCase(),
          label: discipline.code.toUpperCase(),
          helper: discipline.name,
        })),
    [index.disciplines],
  );
  const difficultyOptions = useMemo<ExploreFilterOption<ExploreFilterDifficulty>[]>(
    () =>
      DIFFICULTY_VALUES.map((difficulty) => ({
        value: difficulty,
        label: DIFFICULTY_LABEL[difficulty],
        helper:
          difficulty === "easy"
            ? "GPA 9.0 and up"
            : difficulty === "moderate"
              ? "GPA 7.5 to 8.9"
              : "Below 7.5 GPA",
      })),
    [],
  );
  const ratingOptions = useMemo<ExploreFilterOption<number>[]>(
    () =>
      MIN_RATING_VALUES.map((value) => ({
        value,
        label: `${value}+ stars`,
        helper: "Minimum professor rating",
      })),
    [],
  );
  const feedbackOptions = useMemo<ExploreFilterOption<number>[]>(
    () =>
      MIN_FEEDBACK_VALUES.map((value) => ({
        value,
        label: `${value}+ overall`,
        helper: "Minimum student feedback score",
      })),
    [],
  );
  const filterChips = useMemo<ChipOption[]>(
    () =>
      FILTER_KEYS.filter((key) => {
        if (key === "language") return languageOptions.length > 0;
        if (key === "requirements") return requirementsAvailable;
        return true;
      }).map((key) => ({
        value: key,
        label: chipLabel(key, filters, termNameById),
      })),
    [filters, languageOptions.length, requirementsAvailable, termNameById],
  );

  // Response-weighted 1-5 satisfaction signals (shared @uoplan/core analytics),
  // surfaced as the web cards' satisfaction badge.
  const courseSentiment = useMemo(() => courseSentimentByNorm(feedback), [feedback]);
  const professorSentiment = useMemo(() => professorSentimentByName(feedback), [feedback]);
  const disciplineSentimentMap = useMemo(() => disciplineSentiment(feedback), [feedback]);

  const requirements = useMemo(() => {
    if (!personalization.programUrl) return null;
    const schedules =
      schedulesByTerm.get(personalization.termId ?? "") ??
      schedulesByTerm.values().next().value ??
      null;
    if (!schedules) return null;
    return computePersonalizeRequirements({
      catalogue: bundle.catalogue,
      schedules,
      disciplines: { disciplines: bundle.disciplines, faculties: bundle.faculties },
      programUrl: personalization.programUrl,
      completedCourses: completed.codes,
    });
  }, [
    completed.codes,
    bundle,
    personalization.programUrl,
    personalization.termId,
    schedulesByTerm,
  ]);

  const requirementCandidateSet = useMemo(
    () =>
      filters.contributesToRequirements && requirements
        ? buildRequirementCandidateSet(requirements.remaining, completed.codes)
        : null,
    [completed.codes, filters.contributesToRequirements, requirements],
  );

  const searchFilters = useMemo<ExploreSearchFilters>(
    () => ({
      ...filters,
      contributesToRequirements: filters.contributesToRequirements && requirementsAvailable,
      courseSentimentByNorm: courseSentiment,
      professorSentimentByName: professorSentiment,
      requirementCandidateSet,
    }),
    [courseSentiment, filters, professorSentiment, requirementCandidateSet, requirementsAvailable],
  );
  const results = useMemo(
    () => searchExplore(index, query, searchFilters),
    [index, query, searchFilters],
  );

  const totalResults =
    results.courses.length +
    results.professors.length +
    results.disciplines.length +
    results.faculties.length +
    results.programs.length;
  const cardWidth = layout.columns === 2 ? REGULAR_CARD_WIDTH : CARD_WIDTH;

  useEffect(() => {
    if (!searching) return;
    analytics.capture("explore_search", {
      hasQuery: query.trim().length > 0,
      resultCount: totalResults,
    });
  }, [analytics, query, searching, totalResults]);

  const openFilterDrawer = (value: string) => {
    if (FILTER_KEYS.includes(value as ExploreFilterKey)) {
      setActiveDrawerFilter(value as ExploreFilterKey);
    }
  };

  const applyFilters = (next: ExploreSearchFilters) => {
    setFilters(normalizeFilters(next));
    analytics.capture("explore_filter_applied", { filter: activeDrawerFilter ?? "unknown" });
  };

  const openCourse = (code: string) =>
    router.push({ pathname: "/explore/course/[code]", params: { code } });
  const openProfessor = (slug: string) =>
    router.push({ pathname: "/explore/professor/[slug]", params: { slug } });
  const openDiscipline = (code: string) =>
    router.push({ pathname: "/explore/discipline/[code]", params: { code } });
  const openFaculty = (id: string) =>
    router.push({ pathname: "/explore/faculty/[id]", params: { id } });
  const openProgram = (program: ExploreProgramEntry) => {
    if (program.slug) {
      router.push({
        pathname: "/explore/program/[...slug]",
        params: { slug: program.slug.split("/") },
      });
    } else if (program.url) {
      Linking.openURL(program.url);
    }
  };

  return (
    <RedesignScreen gap={Spacing.three}>
      <ScreenHeader title="Course explorer" subtitle="Search courses, programs and professors" />

      {showBanner ? (
        <BannerPill
          variant="accent"
          icon="sparkles"
          label="Personalize for tailored results"
          onPress={() => router.navigate("/personalize")}
          onClose={() => setShowBanner(false)}
        />
      ) : null}

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search courses, profs, programs…"
      />

      <ChipRow
        options={filterChips}
        value={activeFilterKeys}
        onSelect={openFilterDrawer}
        gutter={Spacing.three}
      />

      {searching ? (
        totalResults > 0 ? (
          <View style={styles.results}>
            {results.courses.length > 0 ? (
              <ResultSection title="Courses">
                {results.courses.map((course) => (
                  <CourseResultCard
                    key={course.code}
                    course={course}
                    sentiment={courseSentiment.get(normalizeCourseCode(course.code))}
                    width={cardWidth}
                    onPress={() => openCourse(course.code)}
                  />
                ))}
              </ResultSection>
            ) : null}

            {results.professors.length > 0 ? (
              <ResultSection title="Professors">
                {results.professors.map((professor) => (
                  <ProfessorResultCard
                    key={professor.slug}
                    professor={professor}
                    sentiment={professorSentiment.get(normalizeProfessorName(professor.name))}
                    width={cardWidth}
                    onPress={() => openProfessor(professor.slug)}
                  />
                ))}
              </ResultSection>
            ) : null}

            {results.disciplines.length > 0 ? (
              <ResultSection title="Disciplines">
                {results.disciplines.map((discipline) => (
                  <DisciplineResultCard
                    key={discipline.code}
                    discipline={discipline}
                    sentiment={disciplineSentimentMap.get(discipline.code.toUpperCase())}
                    width={cardWidth}
                    onPress={() => openDiscipline(discipline.code)}
                  />
                ))}
              </ResultSection>
            ) : null}

            {results.faculties.length > 0 ? (
              <ResultSection title="Faculties">
                {results.faculties.map((faculty) => (
                  <FacultyResultCard
                    key={faculty.id}
                    faculty={faculty}
                    width={cardWidth}
                    onPress={() => openFaculty(faculty.id)}
                  />
                ))}
              </ResultSection>
            ) : null}

            {results.programs.length > 0 ? (
              <ResultSection title="Programs">
                {results.programs.map((program) => (
                  <ProgramResultCard
                    key={program.slug ?? program.title}
                    program={program}
                    width={cardWidth}
                    onPress={() => openProgram(program)}
                  />
                ))}
              </ResultSection>
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text dimmed align="center">
              {query.trim().length > 0
                ? `No results match “${query.trim()}”.`
                : "No courses match the selected filters."}
            </Text>
          </View>
        )
      ) : (
        spotlights.map((spotlight) => (
          <ResultSection key={spotlight.id} title={spotlight.title}>
            {spotlight.courses.map((course) => (
              <CourseResultCard
                key={course.code}
                course={course}
                stat={spotlight.id}
                sentiment={courseSentiment.get(normalizeCourseCode(course.code))}
                width={cardWidth}
                onPress={() => openCourse(course.code)}
              />
            ))}
          </ResultSection>
        ))
      )}

      <ExploreFiltersDrawer
        opened={activeDrawerFilter != null}
        activeFilter={activeDrawerFilter}
        filters={filters}
        levelOptions={levelOptions}
        languageOptions={languageOptions}
        disciplineOptions={disciplineOptions}
        difficultyOptions={difficultyOptions}
        ratingOptions={ratingOptions}
        feedbackOptions={feedbackOptions}
        termOptions={termOptions}
        requirementsAvailable={requirementsAvailable}
        onApply={applyFilters}
        onClose={() => setActiveDrawerFilter(null)}
      />
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  results: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.five,
  },
});

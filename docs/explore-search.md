# Explore Search

The explore search feature lets students look up grade distributions by course code, title, or professor name.

## How it works

### Home page (`/explore/`)

A top-left search bar. Typing any character immediately navigates to `/search/?q=<value>` — no in-page results are shown on the home page itself.

### Search results page (`/search/`)

Accepts a `?q=` URL param. As the user types, the URL is updated via `replace` (no back-stack entries). Results are displayed in two horizontal-scroll sections — **Courses** and **Professors** — styled as cards with grade data:

- **Course cards** — course code, title, most common letter grade, % passing, grade distribution bar
- **Professor cards** — name, RateMyProfessors rating, course count, most common grade, % passing, grade distribution bar

Section order (courses first vs professors first) mirrors the relevance logic in `searchExplore`.

### Course/professor detail pages

On `/explore/course/$course` and `/explore/professor/$legacyId`, the search bar still shows an in-page dropdown list (the original behaviour, using `ExploreSearchResults`). This is separate from the `/search/` page cards.

## How to change it

### Adding a new card section (e.g. Disciplines)

1. Add the new entry type to `gradesSearch.ts` (or a new file).
2. Create `SearchResultDisciplineCard.tsx` following the same pattern as `SearchResultCourseCard.tsx`.
3. Add a `<SearchSection>` block in `SearchResultsPage.tsx`.

### Changing card contents

Edit `SearchResultCourseCard.tsx` or `SearchResultProfessorCard.tsx`. Grade viz comes from `entry.gradeViz` (a `GradeVizData | null`), pre-computed when building the search index.

### Changing how grade data is aggregated

`buildCourseSearchEntries` and `buildExploreProfessorSearchEntries` in `apps/web/src/lib/explore/gradesSearch.ts` aggregate distributions across all offerings per course/professor using `mergeGradeDistributionCounts` + `normalizeGradeVizDistribution`.

## Configuration

No env vars. Search is purely client-side using Fuse.js with a 100ms debounce.

## Dependencies

- `fuse.js` — fuzzy course search
- `schedule` package — `normalizeGradeVizDistribution`, `GradeVizData`, `mergeGradeDistributionCounts`
- `GradeDistributionBottomBar` from `components/calendar/GradeDistributionViz.tsx`
- RateMyProfessors data from `/data/rmp.pb` via `professorRatings` store slice

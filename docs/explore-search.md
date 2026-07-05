# Explore Search

The explore search feature lets students look up grade distributions by course code, title, professor name, or course-description keywords.

## How it works

### Home page (`/explore/`)

A top-left search bar. Typing any character immediately navigates to `/search/?q=<value>` — no in-page results are shown on the home page itself.

### Search results page (`/search/`)

Accepts a `?q=` URL param. As the user types, the URL is updated via `replace` (no back-stack entries). Results are displayed in two horizontal-scroll sections — **Courses** and **Professors** — styled as cards with grade data:

- **Course cards** — course code, title, most common letter grade, % passing, grade distribution bar
- **Professor cards** — name, RateMyProfessors rating, course count, most common grade, % passing, grade distribution bar

Section order (courses first vs professors first) mirrors the relevance logic in `searchExplore`.

### Description keyword matching (compact BM25 index)

Course search also matches **course descriptions**, without ever shipping the raw
description text (which is ~4 MB / ~1.09 MB gzipped). Instead the scraper builds a
compact keyword index and ships only that:

- **Asset:** `catalogue.search.pb` (~423 KB raw / ~198 KB gzip), a
  `DataProto.CourseSearchIndex` message. Built by
  `apps/scraper/src/proto/search-index.ts#buildCourseSearchIndex` from the newest
  description per course, pruned to the top-K TF-IDF terms per course (K = 6).
- **Format:** a front-coded term dictionary (so queries can match a term exactly, by
  **prefix** for search-as-you-type, and by **bounded edit distance** for typo
  tolerance) plus per-course term frequencies and document lengths. Postings are
  delta-encoded per term. No raw text is included.
- **Reader:** `packages/core/src/search/descriptionSearch.ts` — `DescriptionSearchIndex`
  decodes the asset once and answers `search(query)` with BM25 scoring
  (`K1 = 1.2`, `B = 0.75`). Its `tokenizeDescription` is the single source of truth so
  build-time postings and query-time lookups always agree (bilingual EN + FR stopwords,
  diacritic folding, light stemming). Match weights: exact `1.0`, prefix `0.6`,
  fuzzy `0.45`.
- **Web wiring:** loaded lazily on the first non-empty query via
  `apps/web/src/hooks/useDescriptionSearchIndex.ts`. `searchExplore` in `gradesSearch.ts`
  merges description-only hits **below** the Fuse code/title results
  (`appendDescriptionMatches`), deduped by alias-component id and capped at
  `EXPLORE_MAX_COURSE_RESULTS`. Description hits are strictly secondary — they never
  reorder the code/title matches.
- **Native wiring:** bundled with the app (`catalogue.search.pb` in the native asset
  bundle) and decoded in `data-provider.tsx#buildAppData` (best-effort — a missing or
  incompatible asset just disables description search). `explore-index.ts#searchExplore`
  appends description-only matches below the code/title hits via
  `appendCourseDescriptionMatches`, mirroring the web ranking.

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

### Changing the description keyword index

The index format is shared build↔query. To change tokenization, pruning, or scoring:

1. Edit `packages/core/src/search/descriptionSearch.ts` — `tokenizeDescription` (the
   shared tokenizer) and/or the BM25 scoring constants. This is the single source of
   truth.
2. If the wire layout changes, update `apps/scraper/src/proto/search-index.ts`
   (`buildCourseSearchIndex`) and the `DataProto.CourseSearchIndex` proto together, then
   run `pnpm --filter @uoplan/proto generate` + `pnpm build:data-proto`.
3. Re-measure `catalogue.search.pb` size (`node scripts/data-asset-sizes.ts`). The proto
   **format** is versioned with the native app — a format change requires an app update
   (native gates on it), while day-to-day rebuilds ride the content-hashed manifest.

## Configuration

No env vars. Search is purely client-side using Fuse.js with a 100ms debounce.

## Dependencies

- `fuse.js` — fuzzy course search (code + title + professor)
- `DescriptionSearchIndex` (`@uoplan/core/search/descriptionSearch`) — compact BM25 keyword search over course descriptions (`catalogue.search.pb`)
- `schedule` package — `normalizeGradeVizDistribution`, `GradeVizData`, `mergeGradeDistributionCounts`
- `GradeDistributionBottomBar` from `components/calendar/GradeDistributionViz.tsx`
- RateMyProfessors data from `/data/rmp.pb` via `professorRatings` store slice

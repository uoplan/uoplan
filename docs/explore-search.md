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

#### Delivery filter

The Delivery filter adds three course-only modes:

- **Any** leaves results unscoped by delivery.
- **Virtual** keeps courses whose selected alias component has at least one virtual meeting.
- **In-person** keeps courses whose selected alias component has at least one in-person meeting.

Mixed components match both Virtual and In-person. If a **Term** filter is selected, delivery matching uses only that term's loaded offerings. If no Term is selected, delivery matching uses the union across all loaded terms. A matching virtual course card shows a compact **Virtual** badge beside the course code.

Delivery matching is alias-component aware, so historical grade aggregates still stay attached to the retained course card even when newer offerings only match through an alias component. While Delivery is active, the search page hides professor, discipline, faculty, and program result sections because delivery is offering-specific and only meaningfully filters course results.

### Description keyword matching (compact BM25 index)

Course search also matches **course descriptions**, without ever shipping the raw
description text (which is ~4 MB / ~1.09 MB gzipped). Instead the scraper builds a
compact keyword index and ships only that:

- **Asset:** `catalogue.search.pb` (~635 KB raw / ~303 KB gzip), a
  `DataProto.CourseSearchIndex` message. Built by
  `apps/scraper/src/proto/search-index.ts#buildCourseSearchIndex` from the newest
  description per course, keeping every term whose **document frequency** is in the
  `[minDf, maxDf]` band (currently `2 ≤ df ≤ 200`). Dropping hapax terms (df=1, ~35% of
  the vocabulary) trims the dictionary for a negligible recall cost, and dropping only the
  truly ubiquitous words (df > 200, e.g. "data" 439, "learning" 350, "structure" 595,
  all stopword-adjacent and already caught by the primary code/title search) keeps the
  index bounded while retaining genuine content words like "logic" (df=47),
  "chemistry" (84), "machine" (94). This band replaced an earlier per-course top-K TF-IDF
  cap, which kept only the _rarest_ terms per course and dropped meaningful mid-frequency
  words like "logic", the cause of misses such as MAT 2362 for "propositional logic".
- **Format:** a front-coded term dictionary (so queries can match a term exactly, by
  **prefix** for search-as-you-type, and by **bounded edit distance** for typo
  tolerance) plus per-course term frequencies and document lengths. Postings are
  delta-encoded per term. No raw text is included.
- **Reader:** `packages/core/src/search/descriptionSearch.ts` — `DescriptionSearchIndex`
  decodes the asset once and answers `search(query)` with BM25 scoring
  (`K1 = 1.2`, `B = 0.75`). Its `tokenizeDescription` is the single source of truth so
  build-time postings and query-time lookups always agree (bilingual EN + FR stopwords,
  diacritic folding, light stemming). Match weights: exact `1.0`, prefix `0.6`,
  fuzzy `0.45`. A **coordination factor** then scales each course's summed score by
  `0.3 + 0.7 · (matchedTerms / matchableTerms)`, so a course covering more of the query's
  distinct terms (e.g. MAT 2362, matching both "propositional" and "logic") outranks one
  matching only a single, more frequent word whose length-normalized BM25 is higher.
  Single-term queries are unaffected.
- **Web wiring:** loaded lazily on the first non-empty query via
  `apps/web/src/hooks/useDescriptionSearchIndex.ts`. `searchExplore` in `gradesSearch.ts`
  **blends** description (BM25) hits with the Fuse code/title results into one ranked list
  (`mergeDescriptionMatches`): each course's combined score sums its code/title relevance
  (`1 − fuseScore`) and its description relevance (BM25 normalized to the top hit, scaled
  by `DESCRIPTION_MERGE_WEIGHT = 0.5`). A course matching in both is lifted; a strong
  description-only hit can interleave above weaker/fuzzier code/title matches, while strong
  code/title matches still dominate. Deduped by alias-component id, capped at
  `EXPLORE_MAX_COURSE_RESULTS`. (Fuse runs with `includeScore` so per-item scores drive the
  blend and the professors-vs-courses ordering.)
- **Native wiring:** bundled with the app (`catalogue.search.pb` in the native asset
  bundle) and decoded in `data-provider.tsx#buildAppData` (best-effort — a missing or
  incompatible asset just disables description search). `explore-index.ts#searchExplore`
  blends description matches with the code/title hits via `mergeCourseDescriptionMatches`
  (native match score → relevance `1 / (1 + score)`), mirroring the web ranking.

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

## Multi-year catalogue scraping

Student program requirements are based on the academic year they first enrolled, not the current year. This document describes how catalogue data is scraped and loaded per year.

### How it works

**Scraper (`apps/scraper/src/cli/catalogue.ts` → `apps/scraper/src/catalogue/scrape.ts`)** produces one source JSON file per academic year:

- `apps/scraper/data/catalogue/catalogue.{year}.json` — full catalogue (courses + programs) for that year, where `year` is the first calendar year of the academic year range (e.g. `2021` = 2021–2022)
- `apps/scraper/data/catalogue/catalogue.json` — manifest listing all available years: `{ "years": [2024, 2023, ..., 2017] }`

`pnpm build:data-proto` converts those committed source JSON files into git-ignored runtime protobuf assets in `apps/web/public/data/` (`catalogue.{year}.pb` and `catalogue.pb`).

The current academic year is detected dynamically via `getCurrentAcademicYear()` (September = new academic year). Archive years are only scraped if their file does not yet exist; pass `--force` to re-scrape them. The current year is always re-scraped.

**Archive URLs** follow the pattern `https://catalogue.uottawa.ca/archive/{year}-{year+1}/en/...`. The current year uses the root `https://catalogue.uottawa.ca/en/...`. The HTML structure is identical across years.

**App store data slice (`apps/web/src/store/slices/data.ts`, composed by `apps/web/src/store/appStore.ts`)** on startup:

1. Fetches `/data/catalogue.pb` to get `availableYears`
2. Fetches `/data/catalogue.{latestYear}.pb` as the main catalogue (used for course lookups and schedule generation)
3. Decodes protobuf data and stores `availableYears` in state

When the user selects their first year via `setFirstYear(year)`, the store fetches `/data/catalogue.{year}.pb` and stores its `programs` as `yearCataloguePrograms` and courses as `yearCatalogueCourses`. The program selection is cleared since requirements differ between years.

**Catalogue merge (`apps/web/src/store/slices/catalogueUtils.ts`)** builds an effective course list for schedule generation and prerequisite checks:

| Situation                            | Course metadata                      | Prerequisites                                                 |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------- |
| In both year + latest, not completed | Latest (title, credits, description) | Start-year; if year has none, latest prereqs are **stripped** |
| In both, completed                   | Full start-year row                  | Start-year                                                    |
| Latest only (new course)             | Latest                               | Latest                                                        |
| Year only (legacy/dropped)           | Year                                 | Year                                                          |

Latest aliases are still applied after merge so renumbered courses resolve correctly. See `applyYearPrerequisites` in `packages/core/src/dataCache.ts`.

**`ProgramStep` (`apps/web/src/components/steps/ProgramStep.tsx`)** shows a "First year of study" select built from `availableYears`. The program dropdown is built from `yearCataloguePrograms` loaded for the selected first year.

### How to change it

- **Add an older year**: lower `OLDEST_YEAR` in `apps/scraper/src/catalogue/scrape.ts`. Run `pnpm --filter scraper scrape:catalogue` — the new source JSON file will be created and the manifest updated. Then run `pnpm build:data-proto` to refresh runtime `.pb` assets. Existing archive files are skipped unless you pass `--force`.
- **Current year detection**: `getCurrentAcademicYear()` uses `new Date()`. No changes needed year-over-year.
- **Oldest supported year**: the `OLDEST_YEAR = 2017` constant in `apps/scraper/src/catalogue/scrape.ts`.

### Configuration

| Constant                   | File                                   | Purpose                                        |
| -------------------------- | -------------------------------------- | ---------------------------------------------- |
| `OLDEST_YEAR`              | `apps/scraper/src/catalogue/scrape.ts` | Earliest year to scrape                        |
| `getCurrentAcademicYear()` | `apps/scraper/src/catalogue/links.ts`  | Detects current academic year from system date |

### Dependencies

- `cheerio` — HTML parsing
- `p-limit` — concurrency control (10 parallel fetches)
- `zod` — schema validation for scraped output
- `apps/web/src/store/slices/data.ts` — loads and caches year-specific programme lists
- `apps/scraper/src/proto/build.ts` — converts `apps/scraper/data/*.json` into `apps/web/public/data/*.pb`

### Catalogue `.pb` encoding notes (build-time only)

`mapCatalogue` ([`apps/scraper/src/proto/catalogue.ts`](../apps/scraper/src/proto/catalogue.ts)) and the core mirror `toProtoCatalogue`/`fromProtoCatalogue` compact the runtime `catalogue.{year}.pb` without touching the source JSON:

- **Program-requirement course codes** are stored as `code_ref` — a 1-based index into the file's `course_codes` dictionary (`0` = absent). Codes absent from that dictionary (cross-year references) go into a small `Catalogue.extra_codes` list and are referenced by indices past `course_codes.length`.
- **Program-requirement credits** are stored as `credits_x4` (`uint32`, the value ×4; all catalogue credits are exact quarter-multiples) instead of a `double`.

These only affect `ProgramRequirement`; `Course.credits` and the prerequisite tree (`CoursePrereqNode`) keep their `double`/string fields because the Rust schedule engine decodes the same `data.proto` Catalogue and reads them directly.

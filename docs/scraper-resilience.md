# Scraper resilience: bot challenges & important dates

**What it is:** how the daily scrape workflow behaves when uOttawa sites change shape or block the runner.

## Bot challenges (catalogue)

`catalogue.uottawa.ca` can answer GitHub runners with an AWS WAF challenge (`202`, empty body, `x-amzn-waf-action: challenge`). `fetchHtml` (`apps/scraper/src/shared/http.ts`) throws `BotChallengeError` for that (and for any empty 2xx body) instead of returning `""`, which previously produced a 0-course `catalogue.<year>.json` and made `validate` fail every day.

`catalogue/scrape.ts` catches it for the live (current-year) scrape only: the file hydrated from the `data` branch is kept and a `::warning::` annotation is emitted. If no previous file exists the error propagates. We do **not** attempt to solve/evade the challenge — a stale catalogue until the block lifts is the intended degraded mode.

## Important dates

uOttawa split the single tabbed page into one page per term (`…/important-academic-dates-deadlines/fall-2026`, FR `…/dates-importantes-echeances-scolaires/automne-2026`).

- `importantDates/scrape.ts` fetches the index, extracts term links (`extractTermPageLinks`, skips `past-terms`), pairs EN/FR by `(season, year)` and passes them to `parseImportantDatesPages({ enPages, frPages, … })`.
- `sourceId` is now the English slug (`fall-2026`); it appears in item ids (`fall-2026:enrolment:g0:r3`).
- Cells like `Revised - November 27, 2026` / `Date révisée - …` are treated as the date (`stripRevisedPrefix`).
- Past terms are no longer scraped; only terms linked from the index are published (`sourcePublished: "true"`). `reviewedText` is omitted when the page leaves it blank.

**If it breaks again:** save the live pages into `importantDates/__fixtures__/` (trimmed to `<main>`), update `parse.test.ts`, and adjust `parseExtract.ts` (`extractPanelSections` expects an overview table in `section.article-body-left` and FAQ accordions in `section.js-faq`).

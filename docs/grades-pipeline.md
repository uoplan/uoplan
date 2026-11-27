# Grades pipeline (uOttawa)

**What it is:** registrar grade-distribution Excel exports → per-term CSVs → `grades.json` (professor-annotated) → `grades.pb`. uOttawa only (Carleton has no grade data).

## How it works

1. Drop registrar `.xlsx` exports in `apps/scraper/data/uottawa/raw/xlsx/` (gitignored; header row is auto-located by `CLASS_SECTION`).
2. `pnpm --filter scraper grades:convert -- --school=uottawa` → `raw/grades.<STRM>.csv` (one per term, summed per `(term, course, section)`).
3. `pnpm --filter scraper scrape:grades -- --school=uottawa` → reads **every** `raw/grades.*.csv`, attaches feedback professors + RMP ids, writes `grades.json`.
4. `pnpm --filter scraper enrich:schedules`, then `pnpm --filter scraper build:proto -- --school=uottawa` → `.pb` assets. (`pnpm data:grades` runs all of it.)

## Gotchas

- `scrape:grades` **rebuilds from all raw CSVs**. If `raw/` is missing locally (it is gitignored and not on the `data` branch), rebuilding from only the new xlsx drops older terms. Regenerate old CSVs from the existing `grades.json` first (dedupe per `(termId, code, section)`, write with `recordsToCsv`), then add the new xlsx.
- `grades.json` lives on the `data` branch; commit the regenerated file there, not on `main`.

## Sources loaded

| File                              | Terms                                  |
| --------------------------------- | -------------------------------------- |
| `2026-279 Requester Version.xlsx` | 2261 (Winter 2026), 2265 (Summer 2026) |

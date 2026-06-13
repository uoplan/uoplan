# State Encoding

URL sharing and localStorage persistence both use a compact binary format to encode the full app state. This avoids long query strings while keeping URLs self-contained.

## How it works

`packages/core/src/stateEncode.ts` serialises the relevant app state to a protobuf `Uint8Array`, deflate-compresses and base64-encodes it, and attaches it as the `?s=` query parameter. On load the same bytes are inflated and decoded back into app state.

LocalStorage (`uoplan-state`) stores the same base64 blob so the previous session is restored automatically.

### Binary format (compressed `ShareableState` protobuf)

The wire schema lives in `packages/proto/proto/state.proto`; generated TypeScript is exported as `@uoplan/proto/state` and re-exported through `@uoplan/core`'s state helpers. `ShareableState.magic` must equal `STATE_MAGIC` (`0x554f504d`, ASCII `UOPM`).

| Field group            | Proto fields                                                                                                                                                                                                                                                                                       | Notes                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Mode                   | `wizard_mode`, `basic_pinned_courses`, `basic_electives_count`, `basic_excluded_category_indices`                                                                                                                                                                                                  | Basic/advanced wizard state                                                                  |
| Catalogue identity     | `selected_term_id`, `first_year`, `program_index`, `minor_program_index`, `student_program_indices`                                                                                                                                                                                                | Program/course/discipline values are indices into `indices`                                  |
| Course filters         | `completed_courses`, `level_buckets`, `language_buckets`, `elective_level_buckets`, `courses_this_semester`                                                                                                                                                                                        | Completed courses are plain packed course indices (`OPT_SENTINEL_BASE` for OPT placeholders) |
| Schedule navigation    | `first_seed`, `current_seed`, `swaps`, `calendar_week_index`                                                                                                                                                                                                                                       | `selected_schedule_index` is obsolete                                                        |
| Requirement selections | `option_selections`, `course_selections`, `constrained_selections`, `constrained_group_selections`, `touched_req_indices`                                                                                                                                                                          | Requirement references are stable traversal indices                                          |
| Generation preferences | `include_closed_components`, `virtual_sections_only`, `generation_min_start_minutes`, `generation_max_end_minutes`, `generation_min_professor_rating`, `generation_limit_first_year_credits`, `generation_compressed_schedule`, `generation_prefer_easier`, `blacklisted_courses`, `blocked_times` | User-controlled generation constraints                                                       |
| UI state               | `active_step`, `show_calendar`, `french_immersion_stream`, `magic`                                                                                                                                                                                                                                 | `magic` guards incompatible/corrupted state data                                             |

> **Wire version.** `magic` doubles as a coarse schema version. It was bumped from
> `UOPL` (`0x554f504c`) to `UOPM` (`0x554f504d`) when `completed_courses` moved from
> the old two-indices-per-`uint32` bit-pack to plain packed `repeated uint32`
> indices. Bumping `STATE_MAGIC` is a **clean break**: older `?s=` links and saved
> `localStorage` fail the magic guard (`decodeState` returns `null`) and the wizard
> opens fresh instead of decoding corrupt data. Only bump it for genuinely
> wire-incompatible changes.

## Program slugs

Programs are identified by a **slug** rather than the full URL, so indices remain stable across years:

```
https://catalogue.uottawa.ca/en/undergrad/bsc-cs/              → undergrad/bsc-cs
https://catalogue.uottawa.ca/archive/2024-2025/en/undergrad/bsc-cs/ → undergrad/bsc-cs
```

The helper `urlToSlug(url)` in `packages/core/src/stateEncode.ts` performs this conversion. Programmes scraped via `apps/scraper/` have a `slug` field pre-computed; for old catalogue files without the field, the slug is derived on the fly.

`apps/scraper/data/indices.json` stores slugs (not full URLs) in its `programs` array, the full course-code strings in `courses`, and the derived list of distinct 3-letter subject prefixes in `disciplines` (the discipline index space used by `encodeDiscipline`/`decodeDiscipline`). The runtime app loads the protobuf form from `apps/web/public/data/indices.pb`.

### `indices.pb` columnar encoding

The runtime `indices.pb` does **not** store course/program strings verbatim. `toProtoIndices`/`fromProtoIndices` ([`packages/core/src/dataTypes/indices.ts`](../packages/core/src/dataTypes/indices.ts)) encode it columnar to shrink the always-on-the-critical-path asset (≈186 KB → 60 KB raw, 23 KB → 17 KB brotli):

- `disciplines` — distinct subject prefixes, derived from `courses` in first-occurrence order.
- `course_discipline` + `course_number_delta` — each course is `DISC NNNN[suffix]`; the discipline is an index into `disciplines` and the number is **delta-encoded within each discipline** (zigzag `sint32`). Letter suffixes are stored sparsely (`course_suffix_pos`/`course_suffix_char`). Any code that does not round-trip the `DISC NNNN[suffix]` shape falls back to a literal (`course_literal_pos`/`course_literal`).
- `program_prefix_len` + `program_suffix` — programs are front-coded (shared-prefix length + remainder) against the previous entry.

The decoded `Indices.courses`/`programs` order (the state-encoding index space) is preserved exactly, so `?s=` links are unaffected. This is a build-time-only re-encoding; `indices.json` stays human-readable.

## Peeking term & year early

`peekTermAndYear(bytes)` decodes the `ShareableState` protobuf and reads only `selectedTermId` and `firstYear` without needing the catalogue or indices. `loadData` in `src/store/slices/data.ts` calls this before fetching schedules and the year catalogue so the right data files are loaded upfront.

## How to change it

- **Add a new field**: add it to `packages/proto/proto/state.proto`, regenerate `@uoplan/proto`, add to `EncodeInput` and `DecodedState`, encode/decode it in `encodeState`/`decodeState`, and update `getEncodedStateBase64` + `getShareUrl` in `src/store/slices/url.ts`. If the field is needed before catalogue load, also update `peekTermAndYear`.
- **Change the program index format**: update `encodeState` (uses `programSlug()`), `decodeState` (uses slug lookup), and regenerate `indices.json` via `pnpm --filter scraper scrape:catalogue`.
- **Regenerate indices.json**: run `pnpm --filter scraper scrape:catalogue` — [`apps/scraper/src/catalogue/scrape.ts`](../apps/scraper/src/catalogue/scrape.ts) calls `generateIndices()` after the scrape. It **merges** with any existing `indices.json`: existing entries keep their order and indices; for each `catalogue.YYYY.json` present under `apps/scraper/data` (academic years ascending), course codes and program slugs not already seen are **appended** in file order within each year (so encoded URLs and localStorage stay stable as catalogues grow). Years without a file are skipped.

## Dependencies

- `packages/core/src/stateEncode.ts` — `encodeState`/`decodeState`, `peekTermAndYear`, base64 helpers
- `packages/proto/proto/state.proto` — `ShareableState` wire schema (`@uoplan/proto/state` generated exports)
- `packages/core/src/dataTypes.ts` — `Indices` and `Program` types (optional `slug` field)
- `src/store/slices/url.ts` — calls `encodeStateToBase64()` and applies decoded state
- `src/store/slices/data.ts` — calls `peekTermAndYear`, `decodeState`, and `decodeStateFromBase64` during data load
- `src/hooks/usePersistState.ts` — debounce-saves encoded state to localStorage

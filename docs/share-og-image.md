# Share URL & OG Image

## What it is

Two worker endpoints that turn a schedule state into a social-preview share link: `/api/share/:state` returns a minimal HTML redirect page with Open Graph tags, and `/api/og-image/:state` returns a PNG render of the current calendar.

## How it works

### Share URL generation (web app)

When a user clicks **Share**, `getShareUrl()` in `apps/web/src/store/slices/url.ts`:

1. Encodes the current Zustand state to a compressed protobuf using `encodeStateToBase64()` from `@uoplan/core`
2. Converts the resulting standard base64 string to **base64url** (replaces `+`→`-`, `/`→`_`, strips `=`) so it is safe as a URL path segment
3. If a schedule has been generated, encodes the **currently displayed schedule** as an index-based `SchedulePreview` (`@uoplan/proto`'s `schedule.SchedulePreview`) via `encodeSchedulePreview()` and appends it as a `?p=<payload>` query param. Rather than course/section strings, selections are stored as indices into the term's schedules dataset (`schedules.<term>.pb`) — `courseIndex` into the schedules array, and parallel packed `componentIndices`/`sectionIndices` arrays (component into the course's sorted component keys, section into that component's sections) — which keeps the URL compact since the worker loads the same dataset
4. Returns `${origin}/api/share/${base64url}` (with `?p=…` when a schedule exists)

The `?p` payload lets the OG-image worker render the exact schedule **without re-running schedule generation**. The primary state (path segment) remains the canonical share state used for the redirect; `?p` is only consumed by the OG image.

### `/api/share/:state` (HTML redirect)

`buildShareHtml()` in `apps/worker/src/index.ts` produces a minimal HTML page with:

- `og:title`, `og:description`, `og:type`
- `og:image` → `https://uoplan.party/api/og-image/:state?p=<payload>` (the `?p` schedule payload is forwarded only to the OG image)
- `og:image:width` / `og:image:height` (1200×630)
- `twitter:card summary_large_image`
- A `<script>` that immediately redirects to `/schedule/calendar/?s=<state>` — built from the **primary** path state only (converted back from base64url to standard base64). The `?p` payload is **not** preserved in the redirect.

When a social bot (Discord, iMessage, etc.) scrapes the page it sees the OG tags; regular browsers are instantly redirected to the app.

### `/api/og-image/:state` (PNG)

Implemented in `apps/worker/src/ogImage.ts`. It renders directly from the embedded `?p` schedule payload — **no engine, no catalogue/indices, no wizard-state decoding**:

1. **Cache lookup** — checks the Workers Cache API keyed on the `?p` payload (links without a payload share a single placeholder cache entry)
2. **Decode payload** — `SchedulePreview.decode()` yields the term + the chosen courses and sections as indices. If `?p` is absent or invalid, a fallback PNG with the uoplan wordmark is returned (there is **no** fallback to full generation)
3. **Fetch data assets** from `env.ASSETS` — only `schedules.<termId>.pb` (+ optional `grades.pb`)
4. **Enrich grades** — `enrichSchedulesDataWithGrades()` re-attaches grade distributions (no longer embedded in `schedules.*.pb`) so the grade bars render; degrades gracefully if grades are missing
5. **Reconstruct** — `reconstructScheduleFromPreview(preview, schedulesData)` from `@uoplan/core` resolves each course/section index against the schedules data, assembles the `SectionCombo`s + meeting times, and returns `{ schedule, colorMap }` (colours recomputed with `buildColorMap`). This is fast because it skips the requirement solve + timetabling entirely
6. **Render** — `scheduleToEvents()` and `renderCalendarToSvg()` from `@uoplan/calendar` produce an SVG; `@resvg/resvg-wasm` converts SVG → PNG
7. **Cache** — the PNG response is stored in the Workers Cache with `max-age=86400`

> **Note on colours and swaps:** colours are recomputed from the final schedule via `buildColorMap`, so they match the live calendar exactly for generated schedules. After manual course _swaps_ the recomputed colours may differ slightly from the live calendar.
>
> **Note on old links:** share links created before this change (no `?p`) render the placeholder image rather than the schedule.
>
> **Note on index stability:** the `?p` indices reference the deployed `schedules.<term>.pb`. If that dataset is re-scraped/redeployed between a link being created and a bot scraping it, the indices could shift; in practice bots scrape links within seconds, and a mismatch only degrades to a wrong/placeholder preview (never affects the redirect).

## How to change it

### Changing the OG image appearance

Edit `packages/calendar/src/render.ts` — `renderCalendarToSvg()` is a pure function that receives `CalendarEvent[]` and `colorMap`. Change the SVG geometry, colors, or layout there. Key constants:

| Constant            | Default    | Meaning                                  |
| ------------------- | ---------- | ---------------------------------------- |
| `W` / `H`           | 1200 / 630 | OG image pixel size                      |
| `LEFT_BORDER_W`     | 6          | Width of each event's colour stripe      |
| `GRADE_BAR_H`       | 6          | Height of each event's grade bar         |
| `CAL_START_MINUTES` | 480        | Earliest time shown (08:00), from layout |
| `CAL_END_MINUTES`   | 1380       | Latest time shown (23:00), from layout   |

### Changing what schedule is reconstructed

Edit `packages/core/src/schedulePreview.ts` — `reconstructScheduleFromPreview()`. It resolves the embedded `SchedulePreview` indices against the term's `SchedulesData` to build enrollments. The payload itself is produced by `buildSchedulePreview()` (same file) — wrapped by `encodeSchedulePreview()` in `apps/web/src/lib/encodeSchedulePreview.ts`; the encode and decode sides must agree on the index basis (course → `SchedulesData.schedules[]`, component → sorted component keys, section → that component's array).

### Adding more OG tags

Edit `buildShareHtml()` in `apps/worker/src/index.ts`.

## Configuration

No additional env vars or wrangler bindings are needed. The endpoints rely on:

- `env.ASSETS` — to fetch `.pb` data files (`schedules.TERMID.pb`, optional `grades.pb`)
- `caches.default` — Workers Cache API for PNG memoisation

Both are already present in the standard worker deployment.

## Dependencies

| Package             | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `@uoplan/calendar`  | Calendar layout, event conversion, and SVG rendering                 |
| `@uoplan/core`      | `reconstructScheduleFromPreview`, grade enrichment                   |
| `@uoplan/proto`     | `schedule.SchedulePreview` wire format for the embedded `?p` payload |
| `@uoplan/data`      | Loading `.pb` data assets in the Worker                              |
| `@resvg/resvg-wasm` | SVG → PNG conversion in the Worker (WASM, no native modules)         |

The worker no longer depends on `@uoplan/engine`: the OG image is rendered from the embedded schedule payload rather than re-running schedule generation.

# Share URL & OG Image

## What it is

Two worker endpoints that turn a schedule state into a social-preview share link: `/api/share/:state` returns a minimal HTML redirect page with Open Graph tags, and `/api/og-image/:state` returns a PNG render of the current calendar.

## How it works

### Share URL generation (web app)

When a user clicks **Share**, `getShareUrl()` in `apps/web/src/store/slices/url.ts`:

1. Encodes the current Zustand state to a compressed protobuf using `encodeStateToBase64()` from `@uoplan/schedule`
2. Converts the resulting standard base64 string to **base64url** (replaces `+`→`-`, `/`→`_`, strips `=`) so it is safe as a URL path segment
3. Returns `${origin}/api/share/${base64url}`

### `/api/share/:state` (HTML redirect)

`buildShareHtml()` in `apps/worker/src/index.ts` produces a minimal HTML page with:

- `og:title`, `og:description`, `og:type`
- `og:image` → `https://uoplan.party/api/og-image/:state`
- `og:image:width` / `og:image:height` (1200×630)
- `twitter:card summary_large_image`
- A `<script>` that immediately redirects to `/?s=<state>` (the state is converted back from base64url to standard base64 for the `?s=` query parameter used by the app)

When a social bot (Discord, iMessage, etc.) scrapes the page it sees the OG tags; regular browsers are instantly redirected to the app.

### `/api/og-image/:state` (PNG)

Implemented in `apps/worker/src/ogImage.ts`:

1. **Cache lookup** — checks the Workers Cache API keyed on the state string
2. **Peek** — `peekTermAndYearFromBase64()` reads `termId` and `firstYear` without fully decoding
3. **Fetch data assets** from `env.ASSETS` (catalogue manifest → catalogue year → schedules for term → indices)
4. **Decode state** — `decodeStateFromBase64()` returns `DecodedState` with all selections and swaps
5. **Reconstruct schedule** — `reconstructScheduleForPreview()` from `@uoplan/calendar` runs a seed-shuffled `generateSchedules()` and then applies the swaps from the state (best-effort approximation)
6. **Render** — `scheduleToEvents()`, `buildColorMap()`, then `renderCalendarToSvg()` produce an SVG; `@resvg/resvg-wasm` converts SVG → PNG
7. **Cache** — the PNG response is stored in the Workers Cache with `max-age=86400`

If any step fails (invalid state, missing data, generation produces no schedule) a fallback PNG with the uoplan wordmark is returned.

## How to change it

### Changing the OG image appearance

Edit `packages/calendar/src/render.ts` — `renderCalendarToSvg()` is a pure function that receives `CalendarEvent[]` and `colorMap`. Change the SVG geometry, colors, or layout there. Key constants:

| Constant            | Default    | Meaning                        |
| ------------------- | ---------- | ------------------------------ |
| `W` / `H`           | 1200 / 630 | OG image pixel size            |
| `TIME_AXIS_W`       | 52         | Width of left time axis column |
| `HEADER_H`          | 36         | Height of day-name header row  |
| `CAL_START_MINUTES` | 480        | Earliest time shown (08:00)    |
| `CAL_END_MINUTES`   | 1380       | Latest time shown (23:00)      |

### Changing what schedule is reconstructed

Edit `packages/calendar/src/reconstruct.ts` — `reconstructScheduleForPreview()`. The function extracts course codes from `decoded.courseSelections`, shuffles with `createSeededRng(currentSeed)`, runs `generateSchedules()` (limit=1), then applies swaps. This is a best-effort approximation of the user's actual displayed schedule.

### Adding more OG tags

Edit `buildShareHtml()` in `apps/worker/src/index.ts`.

## Configuration

No additional env vars or wrangler bindings are needed. The endpoints rely on:

- `env.ASSETS` — to fetch `.pb` data files (`catalogue.pb`, `catalogue.YEAR.pb`, `schedules.TERMID.pb`, `indices.pb`)
- `caches.default` — Workers Cache API for PNG memoisation

Both are already present in the standard worker deployment.

## Dependencies

| Package             | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `@uoplan/calendar`  | Calendar layout, event conversion, SVG rendering, schedule reconstruction |
| `@uoplan/schedule`  | State decoding, data cache building, schedule generation, proto decoding  |
| `@resvg/resvg-wasm` | SVG → PNG conversion in the Worker (WASM, no native modules)              |

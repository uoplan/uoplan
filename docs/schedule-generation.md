## Schedule generation

How uoplan builds conflict-free timetables from program requirements and user choices.

The selection + timetabling engine is implemented in **Rust** (`packages/engine`) and compiled to
**WASM** with `wasm-pack`/`wasm-bindgen`. Both consumers — the web app's schedule worker and the
Cloudflare OG-image worker — call the **same** WASM module in-process; there is no JavaScript
generation implementation. TypeScript only builds the request, computes the requirement tree, and
maps the engine's response back into UI/store shapes.

### Pipeline

1. **Data** — `packages/core` provides `buildDataCache` over catalogue + schedule JSON. The web app
   loads this into Zustand as `cache`. The engine is constructed from the proto-encoded catalogue +
   schedules bytes (`new Engine(catalogueBytes, schedulesBytes)`); see the host wrappers below.

2. **Requirements** — `computeRequirementsState` / `recomputeStateForProgram` produce
   `remainingRequirements`, `requirementTreeWithStatus`, and `selectedPerRequirement`. This stays in
   TypeScript (it is also consumed by the requirements wizard) and is passed into the engine as part
   of the request. Assign-step auto-select skips honours when it is the only "schedulable" option;
   **`packages/core/src/implicitHonours.ts`** infers the honours thesis for generation when no
   non-honours course has timetable data and the user has not cleared or replaced that slot.

3. **Request building (TS → engine)** — **`packages/core/src/engineBridge.ts`** is the boundary.
   `buildBasicRequest` / `buildAdvancedRequest` turn `AppState`-derived inputs (constraints,
   completed courses, level/language/elective buckets, blacklist, seeds, preferences, the computed
   requirement tree + remaining requirements) into a `GenerationRequest` proto
   (`@uoplan/proto/engine`). The web adapter **`apps/web/src/lib/generateSchedulesAction.ts`**
   resolves desired courses, adds error reporting, and adapts `AppState`. The OG worker reconstructs
   schedules via **`packages/core/src/scheduleFromStateEngine.ts`** (`reconstruct.ts` →
   `reconstructScheduleForPreview(engine, decoded, cache, constraints)`), which adapts a
   `DecodedState` to the same request types.

4. **Generation (Rust/WASM)** — the engine decodes the request, builds requirement pools, samples
   candidates per pool (weighted random selection — lower-level courses preferred via an
   inverse-exponential tier weight; user-constrained courses picked first; non-course-prereq
   penalty), enforces prerequisite eligibility, and timetables the chosen set through the constraint
   pipeline + section-combo / subset enumerators. The seeded RNG makes a given seed reproducible.
   Honours projects yield empty timetables. The result is returned as a `GenerationResponse` proto.

5. **Response mapping (engine → TS)** — `mapGenerationResponse` / `mapTimetableResponse` in
   `engineBridge.ts` turn the proto response back into the existing `GeneratedSchedule` /
   `CourseEnrollment` shapes the store, calendar, ICS export, swap flow, and seed navigation rely on.

6. **Constraints** — `GenerationConstraints` (time window, days, professor rating, first-year credit
   cap, compressed schedule) are carried in the request and applied inside the Rust engine.

### Engine hosts (WASM init)

- **Web** (`apps/web/src/lib/engine/engineHost.ts`) — async init via the wasm-bindgen `web` glue
  (`init({ module_or_path: wasmUrl })`, `import wasmUrl from "@uoplan/engine/wasm?url"`).
  `getScheduleEngine(dataKey)` builds + memoizes an engine for the worker / fallback;
  `getEngineSync(catalogue, schedulesData)` serves synchronous swap paths; `getInMemoryEngine`
  awaits init then builds from in-memory data (used by the main-thread fallback and tests).
- **Worker** (`apps/worker/src/engineHost.ts`) — synchronous init via `initSync({ module })` with
  `import engineWasm from "@uoplan/engine/engine.wasm"`.
- **Node tests** — `initEngineWasmFromModule` + the `apps/web/src/test/engineSetup.ts` vitest setup
  compile the built `packages/engine/pkg/uoplan_engine_bg.wasm` and sync-init it.

### Diagnostics (still in TS)

Relaxation-based failure diagnostics (`packages/core/src/engine/diagnostics/relaxation.ts`, used by
`generationDiagnostics.ts`) remain in TypeScript. They re-run the _retained_ TS timetabling pipeline
with one constraint removed to explain why a course set could not be scheduled. This is failure
_diagnostics_, never user-facing schedule generation, so it does not duplicate the Rust engine.

### Per-slot instructor and meeting dates

Each `MeetingTime` (in `ComponentSection.times`) carries its own `instructor: string | null` and
`meetingDates: [string, string] | null`. The three PeopleSoft columns (Days & Times, Instructor,
Meeting Dates) are zipped by line index in the scraper (`apps/scraper/src/schedules/scrape.ts`).
The overlap check (`packages/core/src/generation/overlaps.ts` → `timesOverlap`, mirrored in Rust)
also verifies meeting-date ranges intersect, so same-time slots in different date ranges (e.g. a
first-half and a second-half course) are not treated as conflicts.

### Build

The WASM engine must be built before the web/worker builds. `pnpm build` runs `build:engine-wasm`
(release) first; `pnpm dev` runs `build:engine-wasm:dev`. Build it directly with
`pnpm --filter @uoplan/engine build:wasm` (release) or `build:wasm:dev`. Rust tests:
`pnpm --filter @uoplan/engine test:rust`.

### Benchmarks

Criterion benchmarks live in `packages/engine/benches/generation.rs` and run natively against the
committed `.pb` datasets (build them first with `pnpm build:data-proto`; the benches skip cleanly if
the artifacts are absent). Run with `pnpm --filter @uoplan/engine bench` (i.e. `cargo bench`). They
cover engine construction, fixed-set timetabling swept over course counts (5/10/15/20) and across
hard-constraint configs (default, compressed, time-window, blocked-times, virtual-only), and full
basic-mode generation with pinned courses and with elective selection. Benchmarks are not run in CI
(`cargo test` does not build `[[bench]]` targets).

### References

| Piece                             | Location                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Rust/WASM engine                  | `packages/engine/` (`src/lib.rs`, `advanced.rs`, …), `engine.proto`             |
| TS ↔ engine boundary              | `packages/core/src/engineBridge.ts`                                             |
| Web app adapter (AppState)        | `apps/web/src/lib/generateSchedulesAction.ts`                                   |
| OG image adapter (DecodedState)   | `packages/core/src/scheduleFromStateEngine.ts`, `reconstruct.ts`                |
| Web WASM host                     | `apps/web/src/lib/engine/engineHost.ts`                                         |
| Worker WASM host                  | `apps/worker/src/engineHost.ts`                                                 |
| Honours inference                 | `packages/core/src/implicitHonours.ts`                                          |
| Shared timetable primitives/types | `packages/core/src/generation/` (`types.ts`, `overlaps.ts`, `sectionCombos.ts`) |
| Relaxation diagnostics (TS)       | `packages/core/src/engine/diagnostics/`, `generationDiagnostics.ts`             |

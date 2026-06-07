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

4. **Generation (Rust/WASM)** — the engine decodes the request, builds requirement pools, and
   **selects** a requirement-satisfying, conflict-free course set that it timetables through the
   constraint pipeline + section-combo / subset enumerators. Selection is **feasibility-aware**
   (see "Course selection" below), not generate-and-test, so success never depends on the seed.
   The seeded RNG makes a given seed reproducible. Honours projects yield empty timetables. The
   result is returned as a `GenerationResponse` proto.

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

### Timetabling solver (Rust)

Once a course set is chosen, the engine fits a conflict-free arrangement in
`packages/engine/src/timetable.rs`. Each course's "domain" is its list of valid section
combos in **seeded order** (`build_timetable_course`), so the seed controls _which_ valid
schedule is returned. The search itself is a **forward-checking + MRV** backtracker
(`first_seeded_arrangement`):

- **MRV (most-constrained variable):** branch on the unassigned course with the fewest
  remaining compatible combos first; ties break by course index for determinism.
- **Forward checking:** after assigning a combo, prune every other unassigned course's
  domain to combos that don't overlap the partial assignment; an emptied domain fails the
  branch immediately instead of thrashing deep in the tree.
- **Final constraints** (compressed schedule, first-year credit cap) are global, so they
  are still checked at the leaf via `passes_final`.
- **Deterministic budget:** the search is bounded by an internal node budget
  (`ARRANGEMENT_NODE_BUDGET`), so the outcome is a pure function of the inputs and never
  depends on the worker's wall-clock timeout. The 3 s kill in
  `apps/web/src/workers/scheduleWorkerClient.ts` remains only as a last-resort safety net.

This guarantees **seed-stable success**: if a conflict-free arrangement exists for a
selected set, it is found for _every_ seed (the seed only varies which valid arrangement
you get). The **basic-mode** pinned+fill path (`first_seeded_subset_arrangement`) instead
uses a **randomized-restart greedy with a work-charged budget** (the same design as the
selection loop below, see _Course selection_): the optional pool here is the entire
filter-matching catalogue (hundreds of courses), so the old exhaustive backtracking fill
scanned the whole remaining pool at every node and bounded node _count_ — not work —
making a single run do billions of overlap checks and most seeds return a **false
negative** (claiming no schedule when one existed). Each restart now reshuffles the
placement order and greedily seats the first compatible combo per course, charging the
budget (`SUBSET_WORK_BUDGET`) by **actual overlap work** (`placed + 1` per combo scanned),
so latency is a function of the inputs and a feasible packing is found for every seed.
Regression coverage:
`packages/engine/tests/seed_stability.rs` (a 24-course set must succeed identically across
256 seeds), `packages/engine/tests/basic_feasibility.rs` (the user's real share-link repro:
23 electives from the default-filter pool must succeed for every seed within budget; an
over-capacity request must fast-fail), plus the `timetable::tests` unit tests.

### Course selection (Rust)

Advanced generation must also choose _which_ courses go into each requirement pool. The old
approach was **generate-and-test**: pick a full course set by weighted-random sampling, then
check whether that exact set timetables. Feasible large sets (≈20+ courses) are rare per random
draw, so whether a run succeeded depended on the seed stumbling onto one before the worker's
3 s kill — the reported "≈50/50 at 22 courses" non-determinism.

Selection is now **feasibility-aware** (`run_pool_pick_pass` in `advanced.rs`): a
**randomized-restart greedy** fill in which a candidate is accepted only when the whole
selection (pinned + already-selected + candidate) still timetables.

- **Feasibility probe (`Search::try_place`)** — accepting a candidate must keep the set
  timetable-able, i.e. equivalent to a full re-solve (`arrange_prebuilt`) over the set. But the
  common case has slack, so we first try the **cheap path**: keep every placed section fixed and
  slot the candidate into the first of its combos that is conflict-free with the _current_
  arrangement (and still passes the global `passes_final` checks). Only when no combo fits the
  fixed arrangement do we fall back to a full re-solve (which may rearrange earlier sections).
  The accept/reject decision is exactly the re-solve's — just reached far more cheaply.
- **Bounded restarts** — a single shuffled order occasionally stalls a few courses short of the
  target (a greedy local maximum). Instead of exhaustive backtracking, we **reshuffle and retry**
  (`SELECTION_RESTARTS`); independent reshuffles drive the chance that _every_ restart stalls to
  effectively zero, so a feasible set is found for every seed. The first restart keeps the
  preference-weighted order (level / prefer-easier biases shape the result); later restarts use
  uniform reshuffles purely to find feasibility.
- **Deterministic budgets** — each restart caps the **expensive** re-solve fallbacks
  (`SELECTION_RESOLVE_BUDGET`) separately from the overall probe budget
  (`SELECTION_PLACEMENT_BUDGET`); cheap placements stay unlimited. A descent that keeps needing
  rearrangements gives up early and restarts rather than grinding through thousands of re-solves,
  keeping the worst case a pure function of the inputs (well under the 3 s kill, ≈0.3–0.5 s as
  WASM even at 24 courses) instead of the wall clock.

Regression coverage: `packages/engine/tests/selection_feasibility.rs` requires a realistic
full-pool request (22–24 courses) to produce a full schedule for many seeds **and** complete
well within a per-seed latency budget — guarding both determinism and the timeout headroom.

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
cover engine construction, fixed-set timetabling swept over course counts (5/10/15/20/24) and across
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

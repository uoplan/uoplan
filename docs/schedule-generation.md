## Schedule generation

How uoplan builds conflict-free timetables from program requirements and user choices.

### Pipeline

1. **Data** — `packages/core` provides `buildDataCache` over catalogue + schedule JSON. The web app loads this into Zustand as `cache`.

2. **Requirements** — `computeRequirementsState` / `recomputeStateForProgram` produce `remainingRequirements`, `requirementTreeWithStatus`, and `selectedPerRequirement`. Assign-step auto-select skips honours when it is the only “schedulable” option; **`packages/core/src/implicitHonours.ts`** infers that honours thesis for generation when no non-honours course has timetable data and the user has not cleared or replaced that slot.

3. **Orchestration** — **`packages/core/src/generateSchedule.ts`** is the canonical shared implementation. The web app calls `generateBasicSchedule` / `generateAdvancedSchedule` via **`apps/web/src/lib/generateSchedulesAction.ts`**, which resolves desired courses, adds error reporting, and adapts `AppState`. The OG image worker reconstructs schedules via **`packages/core/src/scheduleFromState.ts`**, which adapts a `DecodedState` to the same entry points.
   - Pins honours (Constrain, Assign, or implicit), applies forced “courses you want”, and handles the explicit-selection rule with `mergeGlobalExplicitRule` from `packages/core/src/scheduleCandidates/explicitPoolPicks.ts`.
   - Builds **`RequirementPool`s** via `buildRequirementPools` and allocates counts with **`computeCoursesPerPool`** (`packages/core/src/poolHelpers.ts`; re-exported from `apps/web/src/store/scheduleHelpers.ts`), adjusting credits for pinned courses **once per requirement** (`requirementIdForPinnedCourse`).
   - Samples candidates per pool using **weighted random selection** — lower-level courses (1000) are preferred over higher-level ones (2000, 3000, …) via an inverse-exponential weight (`1 / 2^(tier-1)`). User-constrained courses are always picked first for their pool. Courses with non-course prerequisites receive a penalty. The `weightedRandomPick` utility in `packages/core/src/poolHelpers.ts` drives this selection using the seeded RNG.
   - Timetables the chosen course set through the modular engine in **`packages/core/src/engine/`**: `buildTimetablePipeline` assembles the hard constraints, `lazyCombos.ts` produces seeded per-course section combos, and `enumerator.ts` / `subsetEnumerator.ts` find conflict-free arrangements. Honours projects yield empty timetables.

4. **Constraints** — `GenerationConstraints` (time window, days, professor rating, first-year credit cap, compressed schedule) are applied by the engine constraint pipeline in `packages/core/src/engine/constraints/`.

### Per-slot instructor and meeting dates

Each `MeetingTime` (in `ComponentSection.times`) now carries its own `instructor: string | null` and `meetingDates: [string, string] | null` rather than storing a shared array on the section. The three columns in the PeopleSoft HTML table (Days & Times, Instructor, Meeting Dates) are zipped by line index in the scraper (`apps/scraper/src/schedules/scrape.ts`).

The overlap check (`packages/core/src/generation/overlaps.ts` → `timesOverlap`) additionally verifies that the meeting date ranges intersect when both slots carry dates — slots in the same time-of-week but in different date ranges (e.g. a first-half-semester course and a second-half-semester course) are not considered conflicts.

### Per-requirement credit caps

`computeCoursesPerPool` allocates at most `ceil(creditsNeeded / 3)` courses per pool (subject to the semester non-honours target). There is no separate “global elective top-up” pass in the store; extra courses beyond the sum of those caps are not synthesized.

### References

| Piece                           | Location                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pool building + allocation      | `packages/core/src/poolHelpers.ts` (re-exported from `apps/web/src/store/scheduleHelpers.ts`)      |
| Honours inference               | `packages/core/src/implicitHonours.ts`                                                             |
| **Shared generation core**      | **`packages/core/src/generateSchedule.ts`** — `generateBasicSchedule` / `generateAdvancedSchedule` |
| Web app adapter (AppState)      | `apps/web/src/lib/generateSchedulesAction.ts`                                                      |
| OG image adapter (DecodedState) | `packages/core/src/scheduleFromState.ts`                                                           |
| Timetable engine                | `packages/core/src/engine/` (`integration.ts`, `constraints/`, `timetable/`, `stream/`)            |
| Timetable primitives            | `packages/core/src/generation/sectionCombos.ts`, `packages/core/src/generation/overlaps.ts`        |
| Explicit vs general pool split  | `packages/core/src/scheduleCandidates/explicitPoolPicks.ts`, `kUserKGeneral.ts`                    |

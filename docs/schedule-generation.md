## Schedule generation

How uoplan builds conflict-free timetables from program requirements and user choices.

### Pipeline

1. **Data** — `packages/schedule` provides `buildDataCache` over catalogue + schedule JSON. The web app loads this into Zustand as `cache`.

2. **Requirements** — `computeRequirementsState` / `recomputeStateForProgram` produce `remainingRequirements`, `requirementTreeWithStatus`, and `selectedPerRequirement`. Assign-step auto-select skips honours when it is the only “schedulable” option; **`apps/web/src/lib/implicitHonours.ts`** infers that honours thesis for generation when no non-honours course has timetable data and the user has not cleared or replaced that slot.

3. **Orchestration** — **`packages/calendar/src/generateSchedule.ts`** is the canonical shared implementation (used by both the web app and the OG image worker). The web app calls it via **`apps/web/src/lib/generateSchedulesAction.ts`**, which adds error reporting and AppState adaptation. The OG image worker calls it via **`packages/calendar/src/scheduleFromState.ts`**, which adapts a `DecodedState` to the same inputs.
   - Pins honours (Constrain, Assign, or implicit) and optional explicit union from Constrain (`mergeGlobalExplicitRule`, `pickFromUserAndGeneralPools` from `packages/schedule`).
   - Builds **`RequirementPool`s** via `buildRequirementPools` and allocates counts with **`computeCoursesPerPool`** (`apps/web/src/store/scheduleHelpers.ts`), adjusting credits for pinned courses **once per requirement** (`requirementIdForPinnedCourse`).
   - Samples candidates per pool using **weighted random selection** — lower-level courses (1000) are preferred over higher-level ones (2000, 3000, …) via an inverse-exponential weight (`1 / 2^(tier-1)`). User-constrained courses are always picked first for their pool. Courses with non-course prerequisites receive a penalty. The `weightedRandomPick` utility in `scheduleHelpers.ts` drives this selection using the seeded RNG.
   - Then calls **`generateSchedules`** / **`generateSchedulesWithPinned`** in **`packages/schedule/src/scheduleGenerator.ts`** (backtracking over section combos; honours projects use empty timetables).

4. **Constraints** — `GenerationConstraints` (time window, days, professor rating, first-year credit cap, compressed schedule) are applied inside `scheduleGenerator.ts`.

### Per-slot instructor and meeting dates

Each `MeetingTime` (in `ComponentSection.times`) now carries its own `instructor: string | null` and `meetingDates: [string, string] | null` rather than storing a shared array on the section. The three columns in the PeopleSoft HTML table (Days & Times, Instructor, Meeting Dates) are zipped by line index in the scraper (`apps/scrapers/src/schedule_scraper.ts`).

The overlap check (`packages/schedule/src/generation/overlaps.ts` → `timesOverlap`) additionally verifies that the meeting date ranges intersect when both slots carry dates — slots in the same time-of-week but in different date ranges (e.g. a first-half-semester course and a second-half-semester course) are not considered conflicts.

### Per-requirement credit caps

`computeCoursesPerPool` allocates at most `ceil(creditsNeeded / 3)` courses per pool (subject to the semester non-honours target). There is no separate “global elective top-up” pass in the store; extra courses beyond the sum of those caps are not synthesized.

### References

| Piece                           | Location                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Pool building + allocation      | `apps/web/src/store/scheduleHelpers.ts` (re-exports from `@uoplan/schedule`)        |
| Honours inference               | `packages/calendar/src/implicitHonours.ts`                                          |
| **Shared generation core**      | **`packages/calendar/src/generateSchedule.ts`** — used by both web app and OG image |
| Web app adapter (AppState)      | `apps/web/src/lib/generateSchedulesAction.ts`                                       |
| OG image adapter (DecodedState) | `packages/calendar/src/scheduleFromState.ts`                                        |
| Timetable backtracking          | `packages/schedule/src/scheduleGenerator.ts`                                        |
| Explicit vs general pool split  | `packages/schedule/src/scheduleCandidates/explicitPoolPicks.ts`, `kUserKGeneral.ts` |

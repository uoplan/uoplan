# Unified schedule-count options (web + native)

Status: **APPROVED — implementing**
Date: 2026-06-28
Owner: @matteopolak

> **Revision note (2026-07-14):** This document's historical "basic mode shows both counts" and
> "basic N is an independent cap" decisions are superseded. Current product behavior is: when no
> program is selected, web/native hide the program-target control and basic requests derive
> `coursesThisSemester` from that request's cart count (raw basket on web; filtered schedulable
> basket on native); the persisted program target remains for
> program mode only; additional electives stay on top; and there is **no** Rust/proto/store/schema
> or encoding migration.

## Approved decisions (2026-06-28)

- **Engine approach: A** (cart as a highest-priority capped pool + separate elective budget).
- **Encoding: no migration.** Accept that old share links re-interpret the count field; do
  not version the encoding. (User: "no need to migrate. the rest looks good.")
- Keep per-requirement attribution for placed cart courses: **yes**.
- Basic mode (no program) shows **both** counts.
- Defaults: **N = 5, M = 0**.

## Problem

The schedule-generation "count" controls are inconsistent and confusingly modelled
across web and native, and they live in the wrong place on native.

Current state (mapped from code):

- **Web, advanced mode** (`AdvancedGenerationOptions.tsx`, `generateSchedulesAction.ts:349-366`):
  one numeric field labelled **"Electives this semester (additional)"**, backed by the
  store field `coursesThisSemester`. The engine target is
  `advancedCoursesThisSemester = coursesThisSemester + selectedElectivesCount`, where
  `selectedElectivesCount` counts the user's explicit cart/constrained picks. The **cart
  is always fully scheduled** — cart courses become `forced_courses` (standalone) +
  `constrained_per_requirement` pins; there is **no cap** on cart courses.
- **Web, basic mode** (`BasicCalendarSidebarControls.tsx`): same label, backed by
  `basicElectivesCount`; cart pinned, M additional electives synthesized on top.
- **Native, generation sheet** (`schedule-settings-sheet.tsx:378-388`): **"Electives this
  semester (additional)"**, backed by `basicElectivesCount`.
- **Native, personalize page** (`requirement-planner.tsx:167-207`): **"Courses to
  schedule"**, backed by `coursesThisSemester`. The user has complained this is on the
  wrong page — it is a generation option, not a fill-requirements option.

So `coursesThisSemester` is **overloaded**: on web it means "additional electives", on
native it means "total target". The two apps disagree, and the field lives on the
personalize page on native.

## Goal

Two clearly-named generation options, **identical on web and native**, both settable to 0:

1. **"Courses this semester"** (`N`) — a **cap on cart courses**. Schedule at most `N`
   courses from the user's cart. If `N` is **larger** than the cart, the remainder fills
   from the user's **program requirements** (when a program is selected). If `N` is
   **smaller** than the cart, only `N` cart courses are scheduled (the rest are dropped).
2. **"Electives this semester (additional)"** (`M`) — `M` free electives **generated on
   top** of the `N` courses, always (independent of how many requirements exist).

Total scheduled (excluding completed) ≈ `min(N, cart) + requirement-overflow-up-to-N + M`.

Both controls live in the **generation options** UI (web sidebar + native schedule sheet).
**Remove** "Courses to schedule" from the native personalize / fill-requirements page.

## Worked examples

Assume a program is selected.

| Cart                 | N   | M   | Result                                                            |
| -------------------- | --- | --- | ----------------------------------------------------------------- |
| 2 (CSI2110, MAT2377) | 5   | 2   | 2 cart + 3 from requirements + 2 electives = **7**                |
| 6                    | 4   | 1   | **4** of the 6 cart courses + 1 elective = **5** (2 cart dropped) |
| 3                    | 3   | 0   | 3 cart, no requirement overflow, no electives = **3**             |
| 0                    | 5   | 2   | 5 from requirements + 2 electives = **7**                         |
| 4                    | 0   | 3   | 0 cart, 0 requirements, 3 electives = **3**                       |

With **no program** selected (basic mode), "requirements" overflow is unavailable, so
`N` simply caps the cart and `M` adds electives: result ≈ `min(N, cart) + M`.

## Why this is non-trivial (the engine)

Generation is a **single Rust → WASM path** (`packages/engine`). There is no JS
generation. Today:

- `forced_courses` (cart standalone) are **unconditionally pinned** and consume budget
  (`advanced.rs` — every valid forced course is added to `pinned`). There is **no cap**.
- `courses_this_semester` is the **total target**; `remaining_needed = target - pinned`
  is distributed across requirement pools by `compute_courses_per_pool` (structured pools
  first, then broad electives) until the single budget is exhausted (`pools.rs:245-309`).
- `basic_electives_count` (M) is honoured **only in basket mode** (`lib.rs:427-463`): it
  synthesizes one `__basket_electives__` `free_elective` pool with
  `credits_needed = M * DEFAULT_CREDITS_PER_COURSE` and adds M to the budget. In basket
  mode there are no other pools, so M is effectively guaranteed. In **advanced mode it is
  forced to 0** (`engineBridge.ts:365`).

Two gaps vs. the goal:

- **G1 — cart cap.** Cart courses are force-pinned; capping at `N < cart` requires
  _selecting a subset_ of the cart, which the engine never does for forced/constrained
  courses.
- **G2 — guaranteed additional electives in advanced mode.** With one shared budget,
  requirement pools can consume the budget meant for the M electives. To guarantee `M`
  electives _on top_ of the `N` courses, the engine needs the M electives on a **separate
  budget** from the N courses (a two-phase fill).

## Approaches (engine)

### Approach A — Two-budget engine fill + cart as a capped pool (recommended)

Make the engine first-class about the two counts.

- **Proto:** add `additional_electives_count` (M) to `GenerationRequest` so M is carried in
  _both_ modes (today only `basic_electives_count` carries it, and only basket mode reads
  it). Keep `courses_this_semester` = `N`. Optionally add `cart_courses` (repeated) so the
  cart is distinguishable from constrained/forced pins; OR keep sending the cart via the
  existing `forced_courses` + `constrained_per_requirement` and add a `cart_cap` so the
  engine knows the N budget caps them.
- **Engine, phase 1 (N):** instead of unconditionally pinning every cart course, model the
  cart as the **highest-priority capped pool** (cap = N courses). Fill phase-1 budget `N`
  across [cart pool → program requirement pools] using the existing greedy fill. Cart
  courses win ties (highest priority), so for `N ≥ cart` all cart courses are placed and
  the remainder overflows to requirements (≈ current behaviour); for `N < cart` only `N`
  are placed (conflict/objective-aware — solves G1 correctly).
- **Engine, phase 2 (M):** synthesize the `__additional_electives__` `free_elective` pool
  (reuse `electives::expand_elective_pool`) and fill a **separate** budget `M` over it.
  Independent budget ⇒ M guaranteed (solves G2). Works in both basic and advanced mode.
- **Total budget = N + M**, but allocated in two non-overlapping phases.

Pros: correct for every example incl. `N < cart`; one clean model for both modes; cart is
conflict/objective-aware. Cons: largest engine change (touches `advanced.rs` selection
loop + `pools.rs` budget split + `lib.rs` synthesis); needs careful Rust tests; the cart
pool must still report requirement attribution for progress diagnostics (see Open
question 1).

### Approach B — TS-side cart cap + minimal engine change for guaranteed M

- **Cart cap in the bridge (TS):** in `engineBridge.ts` / `generateSchedulesAction.ts`,
  when `N < cart`, select the first/priority `N` cart courses and pass only those as
  forced/constrained; drop the rest _before_ the engine. No engine change for G1.
- **Engine for M:** allow `additional_electives_count` (M) to also apply in advanced mode,
  filled on a separate budget (still needs the two-phase split from Approach A for G2, but
  nothing else changes in the selection core).

Pros: much smaller engine change; lower risk. Cons: the TS cap is **not** conflict- or
objective-aware — it may pick `N` cart courses that mutually conflict and yield an
infeasible/empty schedule even when a feasible `N`-subset exists; "best `N` of the cart"
quality is worse than Approach A.

### Approach C — UI-only guard (no real cap)

Constrain the UI so `N ≥ cart` (cart cap never bites); `N` is the total target, `M` extra
electives. No subset-selection.

Pros: minimal/no engine risk. Cons: **does not implement the user's stated cap** ("it will
cap how many are taken from the cart"). Rejected unless the user de-scopes the cap.

**Recommendation: Approach A.** It is the only approach that fully and correctly
implements the confirmed semantics (including `N < cart`). Approach B is the fallback if we
want to ship faster and accept lower cap quality; we can start with B's bridge cap and
upgrade to A's pool cap later behind the same proto/store/UI.

## Cross-cutting changes (independent of A vs B)

- **Store** (`packages/store`): keep `coursesThisSemester` (now = `N`, the cart cap) and
  rename/clarify `basicElectivesCount` → `additionalElectivesCount` (= `M`) used in BOTH
  modes. Update setters, defaults (`DEFAULT_COURSES_THIS_SEMESTER = 5`,
  `DEFAULT_ADDITIONAL_ELECTIVES = 0`), and hooks (`useCoursesThisSemester`,
  `useAdditionalElectives`). Both min 0.
- **Encoding** (`stateEncode.ts`, `slices/url.ts`): persist both counts; migrate any
  existing encoded `coursesThisSemester` semantics (it currently means "additional
  electives" on web — a one-time interpretation shift; document and, if needed, version
  the encoding so old share links don't silently change meaning).
- **Bridge** (`engineBridge.ts`): `buildAdvancedRequest` and `buildBasicRequest` both set
  `courses_this_semester = N` and `additional_electives_count = M`; thread the cart
  consistently. Remove the advanced-mode `basicElectivesCount = 0` hard-zero.
- **OG worker** (`scheduleFromStateEngine.ts`, `apps/worker/src/engineHost.ts`): rebuild
  requests from `DecodedState` with the same two counts (share-image parity).
- **Web UI** (`generationOptions/GenerationOptionsFields.tsx`,
  `AdvancedGenerationOptions.tsx`, `BasicCalendarSidebarControls.tsx`): show **two**
  numeric fields ("Courses this semester", "Electives this semester (additional)"), both
  min 0; both visible in basic and advanced mode. New i18n id for the "Courses this
  semester" label (en + fr-CA).
- **Native UI**: add the two-field control to `schedule-settings-sheet.tsx`; **remove**
  "Courses to schedule" from `requirement-planner.tsx`. Native strings are inline (not
  Lingui).
- **Native FFI rebuild** (only if the Rust engine changes — A always; B for the M split):
  iOS xcframework via `pnpm build:engine-native-ffi`; Android `.so` via
  `pnpm build:engine-native-ffi-android` (needs `ANDROID_NDK_HOME`).

## Open questions (resolve before/with review)

1. **Requirement attribution.** Today cart courses that map to a requirement become
   `constrained_per_requirement` pins so progress diagnostics credit the right
   requirement. If the cart becomes a single capped pool (Approach A), do we lose/keep
   per-requirement attribution for the _placed_ cart courses? Proposal: keep attribution
   by tagging each placed cart course with its `requirement_id_for_pinned(code)` after
   selection.
2. **Encoding back-compat.** Old share links encode `coursesThisSemester` meaning
   "additional electives" (web). Under the new model that field means the cart cap `N`.
   Do we version the encoding / migrate, or accept that old links re-interpret? Proposal:
   bump the encoding version and map legacy `coursesThisSemester → additionalElectivesCount`,
   defaulting `N` to `max(cartSize, 5)` so old links keep scheduling the whole cart.
3. **Basic mode N.** With no program, `N` only caps the cart (no requirement overflow).
   Confirm the label "Courses this semester" still reads correctly there, or whether basic
   mode should hide `N` and only show `M` (simpler, matches today). Proposal: show both for
   consistency; `N` caps the cart.
4. **Defaults.** `N` default 5, `M` default 0 (preserves the current "extra electives only
   if asked" feel). Confirm.

## Staged implementation plan (on approval)

Each stage independently verified + committed (single-line message, only my files).

1. **Engine (Rust)** — Approach A: cart-as-capped-pool + two-phase budget + advanced-mode
   M synthesis. Cargo tests for every example above incl. `N < cart`. Verify
   `pnpm --filter @uoplan/engine test:rust`; rebuild WASM (`pnpm build:engine-wasm`).
2. **Proto** — add `additional_electives_count` (+ `cart_courses`/`cart_cap` if needed);
   regenerate TS + Rust prost. `pnpm --filter @uoplan/proto generate`.
3. **Bridge** (`engineBridge.ts`) + core tests.
4. **Store** fields/defaults/hooks/encoding + tests.
5. **Web UI** (two fields, both modes) + i18n (`pnpm i18n:sync`, fill en/fr-CA) + a11y.
6. **Native UI** (two fields in sheet; remove from personalize) +
   `pnpm --filter native exec tsc --noEmit` + `pnpm --filter native test` + oxfmt touched.
7. **Native FFI rebuild** (iOS xcframework + Android `.so`) + on-sim verification.
8. Full `pnpm test`, `pnpm typecheck`, `pnpm check:arch`, `pnpm check:i18n`.

## Risk

**High blast radius** — this changes the product's core scheduler. A regression here breaks
generation (the core product). Mitigations: Approach A is gated behind Rust unit tests for
every worked example; the common case (`N ≥ cart`) must reproduce current behaviour
exactly (regression test); ship behind verification at each stage; native FFI rebuilt +
verified on-sim before claiming done.

# Course Group Dropdown Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Any CSI course" / "Any CEG course" synthetic group entries to the Pick Specific Courses MultiSelect, stored as `"group:CSI"` tokens in `constrainedPerRequirement`, expanded to real courses at schedule-generation time, and round-tripped through URL state via a new proto field.

**Architecture:** A new `groupToken.ts` utility provides the token format. `requirementUtils.ts` injects group options into the dropdown and disables covered individual courses. `generateSchedulesAction.ts` expands tokens before processing. The proto gets a new `RequirementGroupSelection` message (field 34) so tokens survive URL encoding without bloating it with thousands of course codes.

**Tech Stack:** TypeScript, Mantine MultiSelect, protobuf / ts-proto (`pnpm generate:proto`), Lingui `.po` files, Vitest.

---

### Task 1: `groupToken.ts` utility

**Files:**
- Create: `packages/schedule/src/utils/groupToken.ts`
- Create: `packages/schedule/src/tests/groupToken.test.ts`
- Modify: `packages/schedule/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/schedule/src/tests/groupToken.test.ts
import { describe, it, expect } from "vitest";
import {
  isGroupToken,
  groupTokenPrefix,
  makeGroupToken,
  subjectPrefix,
} from "../utils/groupToken";

describe("isGroupToken", () => {
  it("returns true for group tokens", () => {
    expect(isGroupToken("group:CSI")).toBe(true);
    expect(isGroupToken("group:MAT")).toBe(true);
  });
  it("returns false for real course codes", () => {
    expect(isGroupToken("CSI 2101")).toBe(false);
    expect(isGroupToken("MAT 1320")).toBe(false);
    expect(isGroupToken("")).toBe(false);
  });
});

describe("groupTokenPrefix", () => {
  it("extracts prefix", () => {
    expect(groupTokenPrefix("group:CSI")).toBe("CSI");
    expect(groupTokenPrefix("group:MAT")).toBe("MAT");
  });
});

describe("makeGroupToken", () => {
  it("creates token from prefix", () => {
    expect(makeGroupToken("CSI")).toBe("group:CSI");
    expect(makeGroupToken("MAT")).toBe("group:MAT");
  });
  it("round-trips with groupTokenPrefix", () => {
    expect(groupTokenPrefix(makeGroupToken("CEG"))).toBe("CEG");
  });
});

describe("subjectPrefix", () => {
  it("extracts subject from course code", () => {
    expect(subjectPrefix("CSI 2101")).toBe("CSI");
    expect(subjectPrefix("MAT 1320")).toBe("MAT");
    expect(subjectPrefix("CEG 2136")).toBe("CEG");
    expect(subjectPrefix("PHY 1122")).toBe("PHY");
  });
  it("returns empty string for empty input", () => {
    expect(subjectPrefix("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A3 "groupToken"
```

Expected: module not found error.

- [ ] **Step 3: Create the utility**

```ts
// packages/schedule/src/utils/groupToken.ts
export function subjectPrefix(courseCode: string): string {
  return courseCode.split(/\s+/)[0]?.toUpperCase() ?? "";
}

export function isGroupToken(s: string): boolean {
  return s.startsWith("group:");
}

export function groupTokenPrefix(s: string): string {
  return s.slice("group:".length);
}

export function makeGroupToken(prefix: string): string {
  return `group:${prefix}`;
}
```

- [ ] **Step 4: Export from the package index**

In `packages/schedule/src/index.ts`, add at the end:

```ts
export * from './utils/groupToken';
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A5 "groupToken"
```

Expected: all 4 describe blocks pass.

- [ ] **Step 6: Commit**

```bash
git add packages/schedule/src/utils/groupToken.ts packages/schedule/src/tests/groupToken.test.ts packages/schedule/src/index.ts
git commit -m "feat: add groupToken utility for course-prefix group selections"
```

---

### Task 2: Translations

**Files:**
- Modify: `apps/web/src/locales/en/messages.po`
- Modify: `apps/web/src/locales/fr-CA/messages.po`

- [ ] **Step 1: Add English translation**

In `apps/web/src/locales/en/messages.po`, insert after the `requirementNode.coursesLabel` block (after line 595):

```po

msgid "requirementNode.anyCourseGroup"
msgstr "Any {prefix} course"
```

- [ ] **Step 2: Add French translation**

In `apps/web/src/locales/fr-CA/messages.po`, insert after the `requirementNode.coursesLabel` block (after line 595):

```po

msgid "requirementNode.anyCourseGroup"
msgstr "Tout cours {prefix}"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/locales/en/messages.po apps/web/src/locales/fr-CA/messages.po
git commit -m "feat: add translation key for course group dropdown entry"
```

---

### Task 3: Group options in `requirementUtils.ts`

**Files:**
- Modify: `apps/web/src/components/requirements/requirementUtils.ts`
- Modify: `apps/web/src/components/requirements/requirementUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/components/requirements/requirementUtils.test.ts`, add a new describe block at the end of the file:

```ts
import { isGroupToken } from "schedule";

describe("getConstrainMultiSelectOptions — group entries", () => {
  function makeNode(
    candidateCourses: string[],
  ): RequirementWithStatus {
    return {
      requirementId: "req-1",
      type: "course",
      title: "Test",
      complete: false,
      satisfiedBy: [],
      candidateCourses,
      creditsNeeded: 3,
    } as unknown as RequirementWithStatus;
  }

  const ctx = {
    ...defaultConstrainCtx,
    prereqEligible: new Set([
      "CSI 2101", "CSI 2520", "CEG 2136", "CEG 3185", "MAT 1320",
    ]),
  };

  it("adds group options before individual courses when prefix has 2+ courses", () => {
    const node = makeNode(["CSI 2101", "CSI 2520", "CEG 2136", "CEG 3185", "MAT 1320"]);
    const { options } = getConstrainMultiSelectOptions(node, {}, ctx);
    const groupOptions = options.filter((o) => isGroupToken(o.value));
    expect(groupOptions.length).toBe(2);
    expect(groupOptions.map((o) => o.value)).toContain("group:CSI");
    expect(groupOptions.map((o) => o.value)).toContain("group:CEG");
    // MAT has only 1 course — no group for it
    expect(groupOptions.map((o) => o.value)).not.toContain("group:MAT");
  });

  it("group options appear before individual course options", () => {
    const node = makeNode(["CSI 2101", "CSI 2520", "MAT 1320"]);
    const { options } = getConstrainMultiSelectOptions(node, {}, ctx);
    const firstNonGroup = options.findIndex((o) => !isGroupToken(o.value));
    const lastGroup = options.reduce(
      (acc, o, i) => (isGroupToken(o.value) ? i : acc),
      -1,
    );
    expect(lastGroup).toBeLessThan(firstNonGroup);
  });

  it("disables individual courses whose prefix is covered by a selected group token", () => {
    const node = makeNode(["CSI 2101", "CSI 2520", "CEG 2136"]);
    const { options } = getConstrainMultiSelectOptions(
      node,
      { "req-1": ["group:CSI"] },
      ctx,
    );
    const csi2101 = options.find((o) => o.value === "CSI 2101");
    const ceg2136 = options.find((o) => o.value === "CEG 2136");
    expect(csi2101?.disabled).toBe(true);
    expect(ceg2136?.disabled).toBe(false);
  });

  it("does not add group token to selectedForDisplay as a course", () => {
    const node = makeNode(["CSI 2101", "CSI 2520"]);
    const { selectedForDisplay } = getConstrainMultiSelectOptions(
      node,
      { "req-1": ["group:CSI"] },
      ctx,
    );
    // group:CSI should be in selectedForDisplay (chip shown)
    expect(selectedForDisplay).toContain("group:CSI");
    // No individual CSI courses should be injected by the selection
    expect(selectedForDisplay).not.toContain("CSI 2101");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A3 "group entries"
```

Expected: failures about group options not existing.

- [ ] **Step 3: Update imports in `requirementUtils.ts`**

At the top of `apps/web/src/components/requirements/requirementUtils.ts`, add `isGroupToken`, `groupTokenPrefix`, `makeGroupToken`, `subjectPrefix` to the `schedule` import:

```ts
import {
  normalizeCourseCode,
  courseMatchesFilters,
  getEffectiveSchedule,
  isHonoursProject,
  isGroupToken,
  groupTokenPrefix,
  makeGroupToken,
  subjectPrefix,
} from "schedule";
```

Also add the `tr` import (it's used in `requirementUtils.ts` for the label):

```ts
import { tr } from "../../i18n";
```

- [ ] **Step 4: Modify `getConstrainMultiSelectOptions`**

Replace the `options` computation at the end of `getConstrainMultiSelectOptions` (the block starting with `const options = availableSorted.map(...)` through `return { selectedForDisplay, options }`) with:

```ts
  // Prefixes covered by currently-selected group tokens
  const selectedGroupPrefixes = new Set<string>(
    selected.filter(isGroupToken).map(groupTokenPrefix),
  );

  // Count courses per prefix among available (real codes only)
  const prefixCounts = new Map<string, number>();
  for (const code of available) {
    const pfx = subjectPrefix(code);
    prefixCounts.set(pfx, (prefixCounts.get(pfx) ?? 0) + 1);
  }

  // Group options for prefixes with ≥ 2 courses, sorted alphabetically
  const groupOptions: ConstrainMultiSelectOption[] = [...prefixCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pfx]) => ({
      value: makeGroupToken(pfx),
      label: tr("requirementNode.anyCourseGroup", { prefix: pfx }),
      disabled: false,
    }));

  // Individual course options — disable if prefix covered by a selected group
  const courseOptions = availableSorted.map((code) => {
    const norm = normalizeCourseCode(code);
    const usedElsewhere =
      ctx.allAssignedCoursesNormalized.has(norm) &&
      !selectedForDisplay.includes(code);
    const coveredByGroup = selectedGroupPrefixes.has(subjectPrefix(code));
    return { value: code, label: code, disabled: usedElsewhere || coveredByGroup };
  });

  const options = [...groupOptions, ...courseOptions];

  return { selectedForDisplay, options };
```

Also update the `available` building loop (the two `for` loops that populate `available`) to skip group tokens in `selectedForDisplay`:

```ts
  const normalizedSeen = new Set<string>();
  const available: string[] = [];
  for (const c of selectedForDisplay) {
    if (isGroupToken(c)) continue;
    const norm = normalizeCourseCode(c);
    if (normalizedSeen.has(norm)) continue;
    normalizedSeen.add(norm);
    available.push(ctx.cache?.getCourse(norm)?.code ?? c);
  }
  for (const c of filtered) {
    const norm = normalizeCourseCode(c);
    if (normalizedSeen.has(norm)) continue;
    normalizedSeen.add(norm);
    available.push(ctx.cache?.getCourse(norm)?.code ?? c);
  }
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A10 "group entries"
```

Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/requirements/requirementUtils.ts apps/web/src/components/requirements/requirementUtils.test.ts
git commit -m "feat: inject course group options into constrain MultiSelect"
```

---

### Task 4: Group entry rendering in `RequirementNode.tsx`

**Files:**
- Modify: `apps/web/src/components/requirements/RequirementNode.tsx`

- [ ] **Step 1: Add import for `isGroupToken`**

Find the `schedule` import block in `RequirementNode.tsx` and add `isGroupToken`:

```ts
import {
  normalizeCourseCode,
  isGroupToken,
  // ... existing imports
} from "schedule";
```

- [ ] **Step 2: Update `renderOption` to style group entries**

In `renderOption`, add a check as the first branch (before the `isUsedElsewhere` check):

```tsx
renderOption={({ option }) => {
  if (isGroupToken(option.value)) {
    return (
      <Text span size="sm" fs="italic" c="dimmed">
        {option.label}
      </Text>
    );
  }
  // ... rest of existing renderOption code unchanged
```

- [ ] **Step 3: Update `filter` to sort group matches first**

Replace the `filter` prop:

```tsx
filter={({ options: opts, search }) => {
  const q = search.toLowerCase().trim();
  if (!q) return opts;
  const matched = (opts as ComboboxItem[]).filter(
    (o) =>
      o.value.toLowerCase().includes(q) ||
      o.label.toLowerCase().includes(q),
  );
  return matched.sort((a, b) => {
    const aGroup = isGroupToken(a.value);
    const bGroup = isGroupToken(b.value);
    if (aGroup && !bGroup) return -1;
    if (!aGroup && bGroup) return 1;
    return 0;
  });
}}
```

- [ ] **Step 4: Verify the app builds**

```bash
cd /Users/matthew/projects/uoplan && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/requirements/RequirementNode.tsx
git commit -m "feat: render and sort course group entries in constrain MultiSelect"
```

---

### Task 5: Proto schema update + regenerate

**Files:**
- Modify: `packages/schedule/proto/state.proto`
- Regenerate: `packages/schedule/src/proto/state.ts` (via `pnpm generate:proto`)

- [ ] **Step 1: Add the new message and field to `state.proto`**

In `packages/schedule/proto/state.proto`, add the new message before `ShareableState`:

```proto
message RequirementGroupSelection {
  uint32 req_index = 1;
  repeated string group_prefixes = 2;
}
```

And inside `ShareableState`, add after the `swaps` line (field 32):

```proto
  repeated RequirementGroupSelection constrained_group_selections = 34;
```

The full updated bottom of the file should look like:

```proto
message RequirementGroupSelection {
  uint32 req_index = 1;
  repeated string group_prefixes = 2;
}

message ShareableState {
  // ... all existing fields unchanged ...
  repeated ScheduleSwap swaps = 32;
  bool show_calendar = 33;
  repeated RequirementGroupSelection constrained_group_selections = 34;
}
```

- [ ] **Step 2: Regenerate `state.ts`**

```bash
cd /Users/matthew/projects/uoplan/packages/schedule && pnpm generate:proto
```

Expected: `src/proto/state.ts` is rewritten with `RequirementGroupSelection` type + encode/decode, and `ShareableState` includes `constrainedGroupSelections: RequirementGroupSelection[]`.

- [ ] **Step 3: Verify the package builds after regeneration**

```bash
cd /Users/matthew/projects/uoplan && pnpm build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/schedule/proto/state.proto packages/schedule/src/proto/state.ts
git commit -m "feat: add RequirementGroupSelection proto message for group token persistence"
```

---

### Task 6: `stateEncode.ts` — encode and decode group tokens

**Files:**
- Modify: `packages/schedule/src/stateEncode.ts`
- Modify: `packages/schedule/src/tests/stateEncode.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/schedule/src/tests/stateEncode.test.ts`, add a new describe block:

```ts
describe("group token round-trip", () => {
  it("encodes and decodes group tokens in constrainedPerRequirement", () => {
    const input = makeInput({
      requirementTreeWithStatus: [
        {
          requirementId: "req-0",
          type: "course",
          title: "Test",
          complete: false,
          satisfiedBy: [],
          candidateCourses: ["CSI 2110", "MAT 1320"],
          creditsNeeded: 3,
        },
      ] as unknown as EncodeInput["requirementTreeWithStatus"],
      constrainedPerRequirement: {
        "req-0": ["group:CSI", "MAT 1320"],
      },
    });

    const bytes = encodeState(input, catalogue, indices);
    expect(bytes).not.toBeNull();

    const decoded = decodeState(bytes!, catalogue, indices);
    expect("error" in decoded).toBe(false);
    if ("error" in decoded) return;

    expect(decoded.constrainedGroupSelections).toHaveLength(1);
    expect(decoded.constrainedGroupSelections[0].groupPrefixes).toEqual(["CSI"]);
    // Real course code preserved in constrainedSelections
    expect(decoded.constrainedSelections[0].courseCodes).toContain("MAT 1320");
  });

  it("encodes only group tokens (no real codes) into constrainedGroupSelections", () => {
    const input = makeInput({
      requirementTreeWithStatus: [
        {
          requirementId: "req-0",
          type: "course",
          title: "Test",
          complete: false,
          satisfiedBy: [],
          candidateCourses: [],
          creditsNeeded: 3,
        },
      ] as unknown as EncodeInput["requirementTreeWithStatus"],
      constrainedPerRequirement: { "req-0": ["group:CSI", "group:CEG"] },
    });

    const bytes = encodeState(input, catalogue, indices);
    expect(bytes).not.toBeNull();

    const decoded = decodeState(bytes!, catalogue, indices);
    expect("error" in decoded).toBe(false);
    if ("error" in decoded) return;

    expect(decoded.constrainedGroupSelections[0].groupPrefixes).toEqual(["CSI", "CEG"]);
    // No real codes — constrainedSelections should be empty for this req
    const constrainedForReq = decoded.constrainedSelections.find(
      (s) => s.reqIndex === decoded.constrainedGroupSelections[0].reqIndex,
    );
    expect(constrainedForReq?.courseCodes ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A5 "group token round-trip"
```

Expected: property `constrainedGroupSelections` does not exist on decoded.

- [ ] **Step 3: Update `DecodedState` type**

In `packages/schedule/src/stateEncode.ts`, in the `DecodedState` interface (around line 96–113), add:

```ts
constrainedGroupSelections: Array<{ reqIndex: number; groupPrefixes: string[] }>;
```

- [ ] **Step 4: Update imports**

Add `isGroupToken` and `groupTokenPrefix` to the imports at the top of `stateEncode.ts`:

```ts
import { isGroupToken, groupTokenPrefix } from './utils/groupToken';
```

- [ ] **Step 5: Update `encodeState` — split group tokens from course codes**

In `encodeState`, update the initial state object (around line 216) to initialize the new field:

```ts
constrainedGroupSelections: [],
```

Then replace the existing `constrainedPerRequirement` loop (lines 251–257):

```ts
  for (const [reqId, codes] of Object.entries(input.constrainedPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex === undefined) continue;

    const realCodes = codes.filter((c) => !isGroupToken(c));
    const groupPrefixes = codes.filter(isGroupToken).map(groupTokenPrefix);

    if (realCodes.length) {
      const courseIndices = realCodes
        .map(encodeCourseCode)
        .filter((i): i is number => i !== undefined);
      if (courseIndices.length) state.constrainedSelections.push({ reqIndex, courseIndices });
    }
    if (groupPrefixes.length) {
      state.constrainedGroupSelections.push({ reqIndex, groupPrefixes });
    }
  }
```

- [ ] **Step 6: Update `decodeState` — return group selections**

In `decodeState`, after the `constrainedSelections` computation (around line 352), add:

```ts
  const constrainedGroupSelections = state.constrainedGroupSelections.map((sel) => ({
    reqIndex: sel.reqIndex,
    groupPrefixes: sel.groupPrefixes,
  }));
```

Then add `constrainedGroupSelections` to the returned object (after `constrainedSelections`):

```ts
    constrainedSelections,
    constrainedGroupSelections,
```

- [ ] **Step 7: Run tests — confirm they pass**

```bash
cd /Users/matthew/projects/uoplan && pnpm test --reporter=verbose 2>&1 | grep -A10 "group token round-trip"
```

Expected: both tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/schedule/src/stateEncode.ts packages/schedule/src/tests/stateEncode.test.ts
git commit -m "feat: encode/decode group tokens in stateEncode for URL persistence"
```

---

### Task 7: `url.ts` — restore group tokens on decode

**Files:**
- Modify: `apps/web/src/store/slices/url.ts`

- [ ] **Step 1: Add import for `makeGroupToken`**

In `apps/web/src/store/slices/url.ts`, add `makeGroupToken` to the `schedule` import:

```ts
import {
  encodeState,
  encodeStateToBase64,
  stateToShareUrl,
  urlToSlug,
  type EncodeInput,
  requirementIdsFromTree,
  withExtraCourses,
  isOptCourse,
  normalizeCourseCode,
  makeGroupToken,
} from "schedule";
```

- [ ] **Step 2: Merge group tokens into `constrainedPerRequirement` on decode**

In `loadEncodedState` (around line 131–138), after the existing `constrainedPerRequirement` loop that reads `decoded.constrainedSelections`, add:

```ts
    for (const { reqIndex, groupPrefixes } of decoded.constrainedGroupSelections) {
      const reqId = reqIndexToId.get(reqIndex);
      if (reqId == null) continue;
      const tokens = groupPrefixes.map(makeGroupToken);
      constrainedPerRequirement[reqId] = [
        ...(constrainedPerRequirement[reqId] ?? []),
        ...tokens,
      ];
    }
```

- [ ] **Step 3: Verify the app builds**

```bash
cd /Users/matthew/projects/uoplan && pnpm build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/store/slices/url.ts
git commit -m "feat: restore group tokens from URL state on decode"
```

---

### Task 8: Expand group tokens in `generateSchedulesAction.ts`

**Files:**
- Modify: `apps/web/src/lib/generateSchedulesAction.ts`

- [ ] **Step 1: Add imports**

In `apps/web/src/lib/generateSchedulesAction.ts`, add to the `schedule` import:

```ts
import {
  // ... existing imports ...
  isGroupToken,
  groupTokenPrefix,
  subjectPrefix,
} from "schedule";
```

- [ ] **Step 2: Add `expandConstrainedPerRequirement` helper before `generateSchedulesAction`**

Add this function in the file before the `generateSchedulesAction` function:

```ts
function expandConstrainedPerRequirement(
  raw: Record<string, string[]>,
  candidatesByReqId: Map<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [reqId, codes] of Object.entries(raw)) {
    const candidates = candidatesByReqId.get(reqId) ?? [];
    const expanded = new Set<string>();
    for (const code of codes) {
      if (isGroupToken(code)) {
        const prefix = groupTokenPrefix(code);
        for (const candidate of candidates) {
          if (subjectPrefix(candidate) === prefix) expanded.add(candidate);
        }
      } else {
        expanded.add(code);
      }
    }
    if (expanded.size > 0) result[reqId] = [...expanded];
  }
  return result;
}
```

- [ ] **Step 3: Shadow `constrainedPerRequirement` with the expanded version**

In the destructuring at line 174, rename `constrainedPerRequirement` to `rawConstrainedPerRequirement`:

```ts
  const {
    cache,
    remainingRequirements,
    requirementTreeWithStatus,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    constrainedPerRequirement: rawConstrainedPerRequirement,
    // ... rest unchanged
  } = state;
```

Then, immediately after the `effectiveRemainingRequirements` line (line 219), add:

```ts
  const candidatesByReqId = new Map<string, string[]>();
  for (const req of effectiveRemainingRequirements) {
    if (req.requirementId && req.candidateCourses) {
      candidatesByReqId.set(req.requirementId, req.candidateCourses);
    }
  }
  const constrainedPerRequirement = expandConstrainedPerRequirement(
    rawConstrainedPerRequirement,
    candidatesByReqId,
  );
```

All subsequent references to `constrainedPerRequirement` in the function body are now the expanded version — no further changes needed.

- [ ] **Step 4: Verify the app builds without errors**

```bash
cd /Users/matthew/projects/uoplan && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/matthew/projects/uoplan && pnpm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/generateSchedulesAction.ts
git commit -m "feat: expand course group tokens before schedule generation"
```

---

## End-to-end verification

After all tasks are complete, manually verify in the browser (`pnpm dev`):

1. Open the wizard, reach the Constrain step for a requirement with courses from 2+ disciplines (a free elective typically works).
2. Open the dropdown — confirm "Any CSI course" and similar group entries appear at the top before individual courses.
3. Search "CEG" — confirm "Any CEG course" floats above "CEG 1100", "CEG 2136", etc.
4. Select "Any CSI course" — a single italic chip appears; individual CSI courses in the dropdown become grayed/disabled.
5. Also select one individual non-CSI course — confirm both chips coexist.
6. Generate schedules — confirm CSI courses appear in the timetable (group was expanded).
7. Select "Any CSI course" AND "CSI 2101" explicitly — generate — confirm no duplicate CSI 2101 issues.
8. Refresh the page — confirm "Any CSI course" chip is still shown (proto round-trip preserved the token).
9. Switch locale to French — confirm the chip and dropdown entry read "Tout cours CSI".

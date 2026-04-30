# Course Group Entries in "Pick Specific Courses" Dropdown

## Context

The "Pick specific courses" MultiSelect in the requirements wizard only lists individual course codes. When a requirement has many electives from a handful of disciplines (e.g. CSI, CEG), users have no quick way to say "any CSI course will do" — they must select each one manually. This design adds synthetic group entries ("Any CSI course") to the dropdown so a single selection covers the whole discipline prefix for that requirement.

---

## Group Token Format

A group selection is stored as a plain string alongside real course codes in the existing `constrainedPerRequirement: Record<string, string[]>` field — no schema changes to the store.

Format: `"group:<PREFIX>"` — e.g. `"group:CSI"`.

Real course codes always contain a space (`"CSI 2101"`), so the formats are unambiguous.

A shared utility at `packages/schedule/src/utils/groupToken.ts` exposes:

```ts
export function isGroupToken(s: string): boolean
export function groupTokenPrefix(s: string): string   // "group:CSI" → "CSI"
export function makeGroupToken(prefix: string): string // "CSI" → "group:CSI"
```

All consumers import from here — no magic strings scattered across files.

---

## Dropdown Option Generation (`requirementUtils.ts`)

Inside `getConstrainMultiSelectOptions`, after the filtered course list is computed:

1. Extract the subject prefix from each course code using the existing `disciplinePrefixFromCourseCode`.
2. For each prefix with **≥ 2** courses in the filtered list, create a group option:
   ```ts
   { value: makeGroupToken(prefix), label: tr("requirementNode.anyCourseGroup", { prefix }), disabled: false }
   ```
3. Insert all group options **before** the individual course options in the returned array, so they appear at the top of an unfiltered dropdown.
4. If a group token for prefix `P` is already in the current selection, mark all individual courses for prefix `P` as `disabled: true` (they're already covered — no need to add them again).

---

## Dropdown UI (`RequirementNode.tsx`)

Three targeted changes:

### `renderOption`
Detect `isGroupToken(option.value)` and render a group-styled row (e.g. italic label, a small "group" icon or badge) instead of the standard "CODE – TITLE" course format.

### `filter`
The existing filter checks `value.includes(q) || label.includes(q)`. Group entries already match because their label contains the prefix. The only addition: **sort group matches before individual course matches** when both share the same prefix. Concretely, if the search term matches a group entry's prefix, that group entry should float to the top of the result list.

### `onChange`
No special handling required — Mantine returns the full `string[]` of selected values, which will naturally include group tokens when selected.

---

## Expansion at Schedule Generation (`generateSchedulesAction.ts`)

At the very start of `generateSchedulesAction`, before any code touches `constrainedPerRequirement`, expand group tokens to real course codes:

```ts
function expandConstrainedPerRequirement(
  constrainedPerRequirement: Record<string, string[]>,
  poolsByCandidates: Map<string, string[]>,  // requirementId → candidateCourses
): Record<string, string[]>
```

For each requirement's code list:
- Leave real course codes as-is.
- Replace each `"group:PREFIX"` with all courses from that requirement's `candidateCourses` whose subject prefix equals `PREFIX`.
- **Deduplicate** the final list (handles the case where the user selected "Any CSI course" + "CSI 2101" explicitly).

The rest of `generateSchedulesAction` sees only real course codes and needs no changes.

---

## URL State Serialization — Proto Changes

`stateEncode.ts` maps each course code to a numeric index via `encodeCourseCode`. Group tokens have no index and would be silently dropped. Expanding them to individual course codes instead would bloat the URL with thousands of entries for large elective pools.

### New proto message and field

In `packages/schedule/proto/state.proto`, add:

```proto
message RequirementGroupSelection {
  uint32 req_index = 1;
  repeated string group_prefixes = 2;  // e.g. ["CSI", "CEG"]
}
```

And in `ShareableState`:

```proto
repeated RequirementGroupSelection constrained_group_selections = 34;
```

Field 34 is the next available number. Old clients that don't know about this field will ignore it (backward-compatible).

After editing the `.proto` file, regenerate `state.ts`:

```bash
cd packages/schedule && pnpm generate:proto
```

### Encode path (`stateEncode.ts`)

When serializing `constrainedPerRequirement`, split each requirement's codes into two buckets:
- **Real course codes** → existing `constrainedSelections` (encoded as course indices, unchanged).
- **Group tokens** → new `constrainedGroupSelections` (encoded as `{ reqIndex, groupPrefixes: ["CSI", "CEG"] }` using `groupTokenPrefix`).

### Decode path (`url.ts`)

When restoring from URL, after reading `constrainedSelections` into `constrainedPerRequirement` as today, also iterate `constrainedGroupSelections` and merge the group tokens back:

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

Group chips are fully preserved through URL round-trips.

---

## Translation

Add one new key to both `.po` files:

**`apps/web/src/locales/en/messages.po`**
```
msgid "requirementNode.anyCourseGroup"
msgstr "Any {prefix} course"
```

**`apps/web/src/locales/fr-CA/messages.po`**
```
msgid "requirementNode.anyCourseGroup"
msgstr "Tout cours {prefix}"
```

Used as: `tr("requirementNode.anyCourseGroup", { prefix: "CSI" })` → `"Any CSI course"`.

---

## Files to Change

| File | Change |
|------|--------|
| `packages/schedule/src/utils/groupToken.ts` | **New** — `isGroupToken`, `groupTokenPrefix`, `makeGroupToken` |
| `apps/web/src/components/requirements/requirementUtils.ts` | Add group option generation in `getConstrainMultiSelectOptions` |
| `apps/web/src/components/requirements/RequirementNode.tsx` | Update `renderOption` and `filter` for group entries |
| `apps/web/src/lib/generateSchedulesAction.ts` | Expand group tokens before processing `constrainedPerRequirement` |
| `packages/schedule/proto/state.proto` | Add `RequirementGroupSelection` message + `constrained_group_selections` field 34 |
| `packages/schedule/src/proto/state.ts` | Regenerated via `pnpm generate:proto` after proto change |
| `packages/schedule/src/stateEncode.ts` | Split group tokens into `constrainedGroupSelections` on encode |
| `apps/web/src/store/slices/url.ts` | Merge group tokens back from `constrainedGroupSelections` on decode |
| `apps/web/src/locales/en/messages.po` | Add `requirementNode.anyCourseGroup` |
| `apps/web/src/locales/fr-CA/messages.po` | Add `requirementNode.anyCourseGroup` |

---

## Verification

1. Open the wizard to a requirement that has courses from 2+ disciplines (e.g. a free elective with CSI and CEG options).
2. Confirm "Any CSI course" and "Any CEG course" appear at the top of the dropdown.
3. Search "CEG" — confirm "Any CEG course" appears before "CEG 1100", "CEG 2136", etc.
4. Select "Any CSI course" — confirm a single chip is shown, and individual CSI courses in the dropdown become disabled.
5. Also select an individual CEG course — confirm it coexists alongside the group chip.
6. Generate schedules — confirm CSI courses appear in generated timetables (group token was expanded correctly).
7. Select both "Any CSI course" and "CSI 2101" explicitly — confirm the expansion deduplicates correctly (CSI 2101 appears only once in the candidate list).
8. Refresh the page and restore from URL — confirm the "Any CSI course" chip is preserved (group token survived the proto round-trip).
9. Verify French locale shows "Tout cours CSI".

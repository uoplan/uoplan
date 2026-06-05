import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowsSort, IconCheck, IconFilter, IconSearch } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { useTr } from "../../i18n";
import { GradeDistributionHistogram } from "./GradeDistributionViz";
import type { SwapDifficulty, SwapSortKey } from "./swapContext";

/** Render the list inside a bounded, virtualized scroll area past this many cards. */
const VIRTUALIZE_THRESHOLD = 20;
/** Max height (px) of the virtualized inner scroll area. */
const VIRTUAL_LIST_MAX_HEIGHT = 360;
/** Estimated row height (px) used before dynamic measurement kicks in. */
const ESTIMATED_ROW_HEIGHT = 64;

const SWAP_I18N = {
  optionConflictAria: "swapCourse.option.conflictAria",
  optionSelectAria: "swapCourse.option.selectAria",
  conflictsWith: "swapCourse.conflictsWith",
  loading: "swapCourse.loading",
  noAlternatives: "swapCourse.noAlternatives",
  poolHad: "swapCourse.poolHad",
  searchPlaceholder: "swapCourse.searchPlaceholder",
  noMatches: "swapCourse.noMatches",
  groupBest: "swapCourse.group.bestMatches",
  groupOther: "swapCourse.group.otherOptions",
  sortLabel: "swapCourse.sort.label",
  sortBest: "swapCourse.sort.best",
  sortAplus: "swapCourse.sort.aplus",
  sortRating: "swapCourse.sort.rating",
  sortAlpha: "swapCourse.sort.alpha",
  filterLabel: "swapCourse.filter.label",
  difficultyAll: "swapCourse.difficulty.all",
  difficultyEasy: "swapCourse.difficulty.easy",
  difficultyModerate: "swapCourse.difficulty.moderate",
  difficultyTough: "swapCourse.difficulty.tough",
} as const;

/** Difficulty bucket from mean course GPA (matches the Explore thresholds). */
function difficultyBucket(gpa: number): SwapDifficulty {
  if (gpa >= 9) return "easy";
  if (gpa >= 7.5) return "moderate";
  return "tough";
}

function SwapCard({
  option,
  onSwap,
}: {
  option: SwapCandidateOption;
  onSwap: (code: string) => void;
}) {
  const tr = useTr();
  const rejected = option.disabled;
  const code = option.value.startsWith("__rejected:") ? option.value.slice(11) : option.value;

  return (
    <UnstyledButton
      type="button"
      disabled={rejected}
      aria-label={
        rejected && option.conflictsWith
          ? tr(SWAP_I18N.optionConflictAria, { course: code, conflict: option.conflictsWith })
          : tr(SWAP_I18N.optionSelectAria, { course: code })
      }
      onClick={() => onSwap(option.value)}
      className="swap-card"
      data-rejected={rejected ? "true" : undefined}
      style={{
        cursor: rejected ? "default" : "pointer",
        display: "block",
        width: "100%",
        textAlign: "left",
        opacity: rejected ? 0.55 : 1,
        borderRadius: 8,
        transition: "background-color 80ms ease",
      }}
    >
      <Group px={10} pt={8} pb={8} align="flex-start" wrap="nowrap" gap="sm">
        {/* Course info */}
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} style={{ lineHeight: 1.3 }}>
            {code}
          </Text>
          {option.title && (
            <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }} truncate>
              {option.title}
            </Text>
          )}
          <Group gap={4} mt={2} wrap="wrap">
            {option.aPlusPercent != null && (
              <Badge
                size="xs"
                variant="light"
                color="green"
                style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                A+ {Math.round(option.aPlusPercent)}%
              </Badge>
            )}
            {option.avgRating != null && (
              <Badge size="xs" variant="light" color="blue">
                ★ {option.avgRating.toFixed(1)}
              </Badge>
            )}
            {option.conflictsWith && (
              <Badge size="xs" color="red" variant="light">
                {tr(SWAP_I18N.conflictsWith, { course: option.conflictsWith })}
              </Badge>
            )}
          </Group>
        </Stack>
        {/* Histogram on the right */}
        {!rejected && option.gradeViz && (
          <Box style={{ flex: "0 0 33%" }}>
            <GradeDistributionHistogram gradeViz={option.gradeViz} variant="compact" hideLabels />
          </Box>
        )}
      </Group>
    </UnstyledButton>
  );
}

function GroupHeading({ label }: { label: string }) {
  return (
    <Text size="xs" c="dimmed" fw={600} px={10} pt={6} pb={2} style={{ letterSpacing: 0.2 }}>
      {label}
    </Text>
  );
}

/** Flat row model so the same list can render virtualized or inline. */
type SwapRow =
  | { kind: "heading"; key: string; label: string; divider: boolean }
  | { kind: "card"; key: string; option: SwapCandidateOption };

function SwapListRow({ row, onSwap }: { row: SwapRow; onSwap: (code: string) => void }) {
  if (row.kind === "heading") {
    return row.divider ? (
      <Box style={{ borderTop: "1px solid var(--app-border)" }}>
        <GroupHeading label={row.label} />
      </Box>
    ) : (
      <GroupHeading label={row.label} />
    );
  }
  return <SwapCard option={row.option} onSwap={onSwap} />;
}

interface SwapListProps {
  modalState: SwapModalState;
  loading: boolean;
  result: SwapResult;
  candidateOptions: SwapCandidateOption[];
  query: string;
  setQuery: (q: string) => void;
  closeModal: () => void;
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
  /** When true, rank easier-than-current courses into a "Best matches" group. */
  preferEasier: boolean;
  /** A+ percentage of the course currently in the schedule (for ranking). */
  currentAPlusPercent: number | null;
  /** Sort order (lifted to context so it survives popover ⇄ fullscreen swaps). */
  sortKey: SwapSortKey;
  setSortKey: (key: SwapSortKey) => void;
  /** Difficulty filter (lifted to context so it survives popover ⇄ fullscreen swaps). */
  difficulty: SwapDifficulty | null;
  setDifficulty: (difficulty: SwapDifficulty | null) => void;
}

export function SwapList({
  modalState,
  loading,
  result,
  candidateOptions,
  query,
  setQuery,
  closeModal,
  onSwap,
  preferEasier,
  currentAPlusPercent,
  sortKey,
  setSortKey,
  difficulty,
  setDifficulty,
}: SwapListProps) {
  const tr = useTr();

  const { bestMatches, otherOptions, rejected, filteredCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (o: SwapCandidateOption) =>
      !q || o.value.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q);
    const matchesDifficulty = (o: SwapCandidateOption) =>
      difficulty === null || (o.gpa != null && difficultyBucket(o.gpa) === difficulty);
    const keep = (o: SwapCandidateOption) => matchesQuery(o) && matchesDifficulty(o);

    const valid = candidateOptions.filter((o) => !o.disabled && keep(o));
    const rejectedList = candidateOptions.filter((o) => o.disabled && keep(o));

    const byAlpha = (a: SwapCandidateOption, b: SwapCandidateOption) =>
      a.value.localeCompare(b.value);
    const byNumberDesc =
      (pick: (o: SwapCandidateOption) => number | null) =>
      (a: SwapCandidateOption, b: SwapCandidateOption) => {
        const diff = (pick(b) ?? -1) - (pick(a) ?? -1);
        return diff !== 0 ? diff : byAlpha(a, b);
      };
    const byPreference =
      sortKey === "best"
        ? preferEasier
          ? byNumberDesc((o) => o.aPlusPercent)
          : byNumberDesc((o) => o.avgRating)
        : null;

    const comparator =
      sortKey === "aplus"
        ? byNumberDesc((o) => o.aPlusPercent)
        : sortKey === "rating"
          ? byNumberDesc((o) => o.avgRating)
          : sortKey === "alpha"
            ? byAlpha
            : (byPreference as (a: SwapCandidateOption, b: SwapCandidateOption) => number);

    const sortedValid = [...valid].sort(comparator);

    // Only split into a "best matches" group in the default (preference) sort,
    // when the user prefers easier courses and some candidate is strictly easier
    // (higher A+ %) than the current one.
    const canSplit =
      sortKey === "best" &&
      preferEasier &&
      currentAPlusPercent != null &&
      sortedValid.some((o) => o.aPlusPercent != null && o.aPlusPercent > currentAPlusPercent);

    if (canSplit) {
      const best = sortedValid.filter(
        (o) => o.aPlusPercent != null && o.aPlusPercent > currentAPlusPercent,
      );
      const other = sortedValid.filter(
        (o) => !(o.aPlusPercent != null && o.aPlusPercent > currentAPlusPercent),
      );
      return {
        bestMatches: best,
        otherOptions: other,
        rejected: rejectedList,
        filteredCount: valid.length + rejectedList.length,
      };
    }

    return {
      bestMatches: [],
      otherOptions: sortedValid,
      rejected: rejectedList,
      filteredCount: valid.length + rejectedList.length,
    };
  }, [candidateOptions, query, preferEasier, currentAPlusPercent, sortKey, difficulty]);

  const hasAnyCandidate =
    result.candidates.length > 0 || (result.rejectedWithConflict?.length ?? 0) > 0;

  const handleSwap = (code: string) => {
    onSwap(modalState.enrollmentIndex, code);
    closeModal();
  };

  // Flatten the groups into a single row list (headings + cards) so the same
  // markup can render inline or inside the virtualizer.
  const rows = useMemo<SwapRow[]>(() => {
    const out: SwapRow[] = [];
    if (bestMatches.length > 0) {
      out.push({ kind: "heading", key: "h:best", label: tr(SWAP_I18N.groupBest), divider: false });
      for (const o of bestMatches) out.push({ kind: "card", key: o.value, option: o });
    }
    if (otherOptions.length > 0) {
      if (bestMatches.length > 0) {
        out.push({
          kind: "heading",
          key: "h:other",
          label: tr(SWAP_I18N.groupOther),
          divider: true,
        });
      }
      for (const o of otherOptions) out.push({ kind: "card", key: o.value, option: o });
    }
    for (const o of rejected) out.push({ kind: "card", key: o.value, option: o });
    return out;
  }, [bestMatches, otherOptions, rejected, tr]);

  const virtualize = filteredCount > VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => rows[index].key,
  });

  const sortOptions: Array<{ key: SwapSortKey; label: string }> = [
    { key: "best", label: tr(SWAP_I18N.sortBest) },
    { key: "aplus", label: tr(SWAP_I18N.sortAplus) },
    { key: "rating", label: tr(SWAP_I18N.sortRating) },
    { key: "alpha", label: tr(SWAP_I18N.sortAlpha) },
  ];
  const difficultyOptions: Array<{ key: SwapDifficulty | null; label: string }> = [
    { key: null, label: tr(SWAP_I18N.difficultyAll) },
    { key: "easy", label: tr(SWAP_I18N.difficultyEasy) },
    { key: "moderate", label: tr(SWAP_I18N.difficultyModerate) },
    { key: "tough", label: tr(SWAP_I18N.difficultyTough) },
  ];

  const controls = !loading && hasAnyCandidate && (
    <Group gap={2} wrap="nowrap">
      <Menu shadow="md" position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label={tr(SWAP_I18N.sortLabel)} position="top" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={tr(SWAP_I18N.sortLabel)}
            >
              <IconArrowsSort size={15} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{tr(SWAP_I18N.sortLabel)}</Menu.Label>
          {sortOptions.map((o) => (
            <Menu.Item
              key={o.key}
              onClick={() => setSortKey(o.key)}
              rightSection={sortKey === o.key ? <IconCheck size={14} /> : null}
            >
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Menu shadow="md" position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label={tr(SWAP_I18N.filterLabel)} position="top" withArrow>
            <ActionIcon
              variant="subtle"
              color={difficulty ? "blue" : "gray"}
              size="sm"
              aria-label={tr(SWAP_I18N.filterLabel)}
            >
              <IconFilter size={15} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{tr(SWAP_I18N.filterLabel)}</Menu.Label>
          {difficultyOptions.map((o) => (
            <Menu.Item
              key={o.key ?? "all"}
              onClick={() => setDifficulty(o.key)}
              rightSection={difficulty === o.key ? <IconCheck size={14} /> : null}
            >
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <>
        <TextInput
          placeholder={tr(SWAP_I18N.searchPlaceholder)}
          leftSection={<IconSearch size={16} />}
          size="sm"
          disabled
        />
        <Box style={{ border: "1px solid var(--app-border)", borderRadius: 8, overflow: "hidden" }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Group key={i} px={10} py={8} align="flex-start" wrap="nowrap" gap="sm">
              <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Skeleton height={12} width="55%" radius="sm" />
                <Skeleton height={10} width="80%" radius="sm" />
                <Skeleton height={14} width={70} radius="sm" />
              </Stack>
              <Skeleton height={36} width="33%" radius="sm" />
            </Group>
          ))}
        </Box>
      </>
    );
  } else if (!hasAnyCandidate) {
    const pool = result.poolCourses;
    body = (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {tr(SWAP_I18N.noAlternatives)}
        </Text>
        {pool.length > 0 && (
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            {tr(SWAP_I18N.poolHad, { count: pool.length })}: {pool.slice(0, 20).sort().join(", ")}
            {pool.length > 20 ? "…" : ""}
          </Text>
        )}
      </Stack>
    );
  } else {
    body = (
      <>
        <TextInput
          placeholder={tr(SWAP_I18N.searchPlaceholder)}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          size="sm"
        />

        {filteredCount === 0 ? (
          <Text size="sm" c="dimmed" py="xs">
            {tr(SWAP_I18N.noMatches)}
          </Text>
        ) : virtualize ? (
          <Box
            ref={scrollRef}
            style={{
              border: "1px solid var(--app-border)",
              borderRadius: 8,
              overflowY: "auto",
              maxHeight: VIRTUAL_LIST_MAX_HEIGHT,
            }}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <SwapListRow row={row} onSwap={handleSwap} />
                  </div>
                );
              })}
            </div>
          </Box>
        ) : (
          <Box
            style={{ border: "1px solid var(--app-border)", borderRadius: 8, overflow: "hidden" }}
          >
            {rows.map((row) => (
              <SwapListRow key={row.key} row={row} onSwap={handleSwap} />
            ))}
          </Box>
        )}
      </>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" fw={600}>
          {tr("calendar.swap.swapWith")}
        </Text>
        {controls}
      </Group>
      {body}
    </Stack>
  );
}

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowsSort, IconCheck, IconFilter, IconSearch } from "@tabler/icons-react";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { useTr } from "../../i18n";
import { GradeDistributionHistogram } from "./GradeDistributionViz";

type SwapSortKey = "best" | "aplus" | "rating" | "alpha";
type SwapDifficulty = "easy" | "moderate" | "tough";

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

export interface SwapListProps {
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
}: SwapListProps) {
  const tr = useTr();
  const [sortKey, setSortKey] = useState<SwapSortKey>("best");
  const [difficulty, setDifficulty] = useState<SwapDifficulty | null>(null);

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
      <Text size="sm" c="dimmed">
        {tr(SWAP_I18N.loading)}
      </Text>
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
        ) : (
          <Box
            style={{ border: "1px solid var(--app-border)", borderRadius: 8, overflow: "hidden" }}
          >
            {bestMatches.length > 0 && (
              <>
                <GroupHeading label={tr(SWAP_I18N.groupBest)} />
                {bestMatches.map((option) => (
                  <SwapCard key={option.value} option={option} onSwap={handleSwap} />
                ))}
              </>
            )}

            {otherOptions.length > 0 && (
              <>
                {bestMatches.length > 0 && (
                  <Box style={{ borderTop: "1px solid var(--app-border)" }}>
                    <GroupHeading label={tr(SWAP_I18N.groupOther)} />
                  </Box>
                )}
                {otherOptions.map((option) => (
                  <SwapCard key={option.value} option={option} onSwap={handleSwap} />
                ))}
              </>
            )}

            {rejected.map((option) => (
              <SwapCard key={option.value} option={option} onSwap={handleSwap} />
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

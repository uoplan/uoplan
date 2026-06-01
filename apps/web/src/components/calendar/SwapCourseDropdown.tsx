import { useState, useMemo } from "react";
import { Badge, Box, Group, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { useTr } from "../../i18n";
import { GradeDistributionHistogram } from "./GradeDistributionViz";

type SortKey = "aplus" | "rating" | "alpha";

const SWAP_I18N = {
  optionConflictAria: "swapCourse.option.conflictAria",
  optionSelectAria: "swapCourse.option.selectAria",
  conflictsWith: "swapCourse.conflictsWith",
  loading: "swapCourse.loading",
  noAlternatives: "swapCourse.noAlternatives",
  poolHad: "swapCourse.poolHad",
  sortAplus: "swapCourse.sort.aplus",
  sortRating: "swapCourse.sort.rating",
  sortAlpha: "swapCourse.sort.alpha",
  searchPlaceholder: "swapCourse.searchPlaceholder",
  sortBy: "swapCourse.sortBy",
  noMatches: "swapCourse.noMatches",
} as const;

function SwapCard({
  option,
  onSwap,
}: {
  option: SwapCandidateOption;
  onSwap: (code: string) => void;
}) {
  const tr = useTr();
  const [hovered, setHovered] = useState(false);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: rejected ? "default" : "pointer",
        display: "block",
        width: "100%",
        textAlign: "left",
        opacity: rejected ? 0.55 : 1,
        backgroundColor: hovered && !rejected ? "var(--app-surface)" : "transparent",
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
            <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
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

export function SwapCourseDropdown({
  modalState,
  loading,
  result,
  candidateOptions,
  query,
  setQuery,
  closeModal,
  onSwap,
  inline = false,
}: {
  modalState: SwapModalState | null;
  loading: boolean;
  result: SwapResult;
  candidateOptions: SwapCandidateOption[];
  query: string;
  setQuery: (q: string) => void;
  closeModal: () => void;
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
  /** When true, the list renders without its own scroll container (parent scrolls). */
  inline?: boolean;
}) {
  const tr = useTr();
  const [sort, setSort] = useState<SortKey>("aplus");

  if (loading) {
    return (
      <Text size="sm" c="dimmed">
        {tr(SWAP_I18N.loading)}
      </Text>
    );
  }

  const hasRejected = (result.rejectedWithConflict?.length ?? 0) > 0;
  if (result.candidates.length === 0 && !hasRejected) {
    const pool = result.poolCourses;
    return (
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
  }

  const q = query.trim().toLowerCase();

  const SORT_LABELS: Record<SortKey, string> = {
    aplus: tr(SWAP_I18N.sortAplus),
    rating: tr(SWAP_I18N.sortRating),
    alpha: tr(SWAP_I18N.sortAlpha),
  };

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <TextInput
          placeholder={tr(SWAP_I18N.searchPlaceholder)}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          size="sm"
          style={{ flex: 1 }}
        />
        <Group gap={4}>
          {(["aplus", "rating", "alpha"] as SortKey[]).map((key) => (
            <UnstyledButton
              key={key}
              type="button"
              onClick={() => setSort(key)}
              aria-label={tr(SWAP_I18N.sortBy, { label: SORT_LABELS[key] })}
              aria-current={sort === key ? "true" : undefined}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: sort === key ? 700 : 400,
                color:
                  sort === key
                    ? "var(--mantine-color-accentBlue-4)"
                    : "var(--mantine-color-dimmed)",
                backgroundColor:
                  sort === key ? "var(--mantine-color-accentBlue-light)" : "transparent",
                userSelect: "none",
              }}
            >
              {SORT_LABELS[key]}
            </UnstyledButton>
          ))}
        </Group>
      </Group>

      <SortedFilteredList
        options={candidateOptions}
        query={q}
        sort={sort}
        modalState={modalState}
        onSwap={onSwap}
        closeModal={closeModal}
        inline={inline}
      />
    </Stack>
  );
}

function SortedFilteredList({
  options,
  query,
  sort,
  modalState,
  onSwap,
  closeModal,
  inline,
}: {
  options: SwapCandidateOption[];
  query: string;
  sort: SortKey;
  modalState: SwapModalState | null;
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
  closeModal: () => void;
  inline?: boolean;
}) {
  const tr = useTr();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter(
          (o) => o.value.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q),
        )
      : options;

    const sorted = [...base].sort((a, b) => {
      if (sort === "aplus") {
        const diff = (b.aPlusPercent ?? -1) - (a.aPlusPercent ?? -1);
        if (diff !== 0) return diff;
      } else if (sort === "rating") {
        const diff = (b.avgRating ?? -1) - (a.avgRating ?? -1);
        if (diff !== 0) return diff;
      }
      return a.value.localeCompare(b.value);
    });

    // Conflict-rejected always last
    return [...sorted.filter((o) => !o.disabled), ...sorted.filter((o) => o.disabled)];
  }, [options, query, sort]);

  if (filtered.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="xs">
        {tr(SWAP_I18N.noMatches)}
      </Text>
    );
  }

  const cards = filtered.map((option) => (
    <SwapCard
      key={option.value}
      option={option}
      onSwap={(code) => {
        onSwap(modalState!.enrollmentIndex, code);
        closeModal();
      }}
    />
  ));

  if (inline) {
    return <Box style={{ border: "1px solid var(--app-border)" }}>{cards}</Box>;
  }

  return (
    <Box
      style={{
        maxHeight: 320,
        overflowY: "auto",
        border: "1px solid var(--app-border)",
      }}
    >
      {cards}
    </Box>
  );
}

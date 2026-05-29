import { useState, useMemo } from "react";
import { Badge, Box, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { SwapCandidateOption, SwapModalState, SwapResult } from "../../hooks/useSwapModal";
import { GradeDistributionHistogram } from "./GradeDistributionViz";

type SortKey = "aplus" | "rating" | "alpha";

function SwapCard({
  option,
  onSwap,
}: {
  option: SwapCandidateOption;
  onSwap: (code: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const rejected = option.disabled;
  const code = option.value.startsWith("__rejected:") ? option.value.slice(11) : option.value;

  return (
    <Box
      onClick={() => !rejected && onSwap(option.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: rejected ? "default" : "pointer",
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
                × {option.conflictsWith}
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
    </Box>
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
  const [sort, setSort] = useState<SortKey>("aplus");

  if (loading) {
    return (
      <Text size="sm" c="dimmed">
        Finding swap options…
      </Text>
    );
  }

  const hasRejected = (result.rejectedWithConflict?.length ?? 0) > 0;
  if (result.candidates.length === 0 && !hasRejected) {
    const pool = result.poolCourses;
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          No alternative courses available that fit your schedule.
        </Text>
        {pool.length > 0 && (
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            Pool had {pool.length} course(s): {pool.slice(0, 20).sort().join(", ")}
            {pool.length > 20 ? "…" : ""}
          </Text>
        )}
      </Stack>
    );
  }

  const q = query.trim().toLowerCase();

  const SORT_LABELS: Record<SortKey, string> = {
    aplus: "A+",
    rating: "★ Rating",
    alpha: "A–Z",
  };

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <TextInput
          placeholder="Search courses…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          size="sm"
          style={{ flex: 1 }}
        />
        <Group gap={4}>
          {(["aplus", "rating", "alpha"] as SortKey[]).map((key) => (
            <Box
              key={key}
              onClick={() => setSort(key)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: sort === key ? 700 : 400,
                color:
                  sort === key ? "var(--mantine-color-violet-4)" : "var(--mantine-color-dimmed)",
                backgroundColor: sort === key ? "var(--mantine-color-violet-light)" : "transparent",
                userSelect: "none",
              }}
            >
              {SORT_LABELS[key]}
            </Box>
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
        No matches
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

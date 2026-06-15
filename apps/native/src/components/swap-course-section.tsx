import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { GradeVizBar } from "@/components/grade-viz-bar";
import { SearchField } from "@/components/redesign/search-field";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import { filterSwapOptions, type SwapOption, type SwapSortKey } from "@/lib/swap-course";

type Difficulty = "easy" | "moderate" | "tough";

const DIFFICULTY_FILTERS: { value: Difficulty | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "easy", label: "Easier" },
  { value: "moderate", label: "Moderate" },
  { value: "tough", label: "Harder" },
];

const SORTS: { value: SwapSortKey; label: string }[] = [
  { value: "best", label: "Top rated" },
  { value: "aplus", label: "Most A+" },
  { value: "alpha", label: "A–Z" },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SwapRow({ option, onSwap }: { option: SwapOption; onSwap: (code: string) => void }) {
  const rating = option.avgRating;
  const aPlus = option.aPlusPercent;
  return (
    <Pressable
      onPress={() => onSwap(option.code)}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={`Swap to ${option.code}`}
    >
      <View style={styles.rowHead}>
        <View style={styles.rowText}>
          <Text style={styles.rowCode}>{option.code}</Text>
          {option.title ? (
            <Text style={styles.rowTitle} numberOfLines={1}>
              {option.title}
            </Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          {rating != null ? (
            <Text style={styles.badge}>★ {rating.toFixed(1).replace(/\.0$/, "")}</Text>
          ) : null}
          {aPlus != null ? <Text style={styles.badge}>{Math.round(aPlus)}% A+</Text> : null}
        </View>
      </View>
      <GradeVizBar gradeViz={option.gradeViz} height={6} />
    </Pressable>
  );
}

/**
 * The "Swap course" block inside the calendar event drawer — the native analogue
 * of the web `SwapList`. Lets the user search, filter by difficulty, sort, and
 * pick an alternative course that still fits every other class in the current
 * timetable. The heavy candidate computation happens in the parent; this view
 * only owns the search/filter/sort state and renders the (already-computed)
 * options via the shared {@link filterSwapOptions} core.
 */
export function SwapCourseSection({
  options,
  loading,
  onSwap,
}: {
  options: SwapOption[];
  loading: boolean;
  onSwap: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [sort, setSort] = useState<SwapSortKey>("best");

  const filtered = useMemo(
    () => filterSwapOptions(options, { query, difficulty, sort }),
    [options, query, difficulty, sort],
  );

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Swap course</Text>
      <Text style={styles.hint}>
        Replace this class with another that still fits your timetable.
      </Text>

      <SearchField value={query} onChangeText={setQuery} placeholder="Search alternatives…" />

      <View style={styles.chipRow}>
        {DIFFICULTY_FILTERS.map((d) => (
          <Chip
            key={d.label}
            label={d.label}
            active={difficulty === d.value}
            onPress={() => setDifficulty(d.value)}
          />
        ))}
      </View>
      <View style={styles.chipRow}>
        {SORTS.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            active={sort === s.value}
            onPress={() => setSort(s.value)}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={Surface.accent} />
          <Text style={styles.statusText}>Finding alternatives…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.statusText}>
          {options.length === 0
            ? "No other course fits alongside your current classes."
            : "No alternatives match your filters."}
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((option) => (
            <SwapRow key={option.code} option={option} onSwap={onSwap} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    paddingTop: Spacing.three,
  },
  sectionTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  hint: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
    lineHeight: 17,
    marginTop: -Spacing.one,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  chipActive: {
    backgroundColor: Surface.accentSoft,
    borderColor: Surface.accent,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: "600",
    color: Surface.dimmed,
  },
  chipTextActive: {
    color: Surface.accent,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  statusText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
    paddingVertical: Spacing.one,
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  rowPressed: {
    backgroundColor: Surface.accentSoft,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowCode: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: "700",
    color: Surface.label,
    letterSpacing: -0.2,
  },
  rowTitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Surface.dimmed,
    marginTop: 1,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    flexShrink: 0,
  },
  badge: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
  },
});

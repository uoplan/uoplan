import { ScrollView, StyleSheet } from "react-native";

import { Chip, type ChipOption } from "./chip";

interface ChipRowProps {
  options: ChipOption[];
  /** Currently-selected value(s). */
  value: string | string[];
  onSelect: (value: string) => void;
  /**
   * Horizontal page padding the row breaks out of (and re-insets to), so the
   * chips scroll edge-to-edge like the full-bleed card carousels while the
   * first/last chip still line up with the page content. Pass the page gutter
   * (`Spacing.three`) when the row is a direct child of the page content.
   * Defaults to `0` (no breakout) so nested usages (e.g. inside a card or
   * column) aren't pulled outside their container.
   */
  gutter?: number;
}

/**
 * A horizontally-scrolling row of filter chips, matching the web mobile explore
 * filter bar. When given a {@link gutter}, the track breaks out of the page
 * gutter so chips scroll all the way to the screen edges (no dead side margins)
 * while the first/last chips inset to align with the page content — mirroring
 * the card carousels. Selection may be single (string) or multi (string[]).
 */
export function ChipRow({ options, value, onSelect, gutter = 0 }: ChipRowProps) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          active={selected.includes(option.value)}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
});

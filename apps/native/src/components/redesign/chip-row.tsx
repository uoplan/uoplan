import { ScrollView, StyleSheet, View } from "react-native";

import { Chip, type ChipOption } from "./chip";

interface ChipRowProps {
  options: ChipOption[];
  /** Currently-selected value(s). */
  value: string | string[];
  onSelect: (value: string) => void;
}

/**
 * A horizontally-scrolling row of filter chips, matching the web mobile explore
 * filter bar. Selection may be single (string) or multi (string[]).
 */
export function ChipRow({ options, value, onSelect }: ChipRowProps) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          active={selected.includes(option.value)}
          onPress={() => onSelect(option.value)}
        />
      ))}
      <View style={styles.tail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  tail: {
    width: 4,
  },
});

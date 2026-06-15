import { Pressable, StyleSheet } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Surface } from "@/constants/theme";

export interface ChipOption {
  value: string;
  label: string;
  icon?: IconName;
}

interface ChipProps {
  option: ChipOption;
  active: boolean;
  onPress: () => void;
}

/** A single rounded filter chip — dark ink fill when active, hairline outline
 *  on paper when inactive. Mirrors the web mobile explore filter pills. */
export function Chip({ option, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      {option.icon ? (
        <AppIcon name={option.icon} size={14} color={active ? Surface.onAccent : Surface.dimmed} />
      ) : null}
      <Text size="sm" color={active ? Surface.onAccent : Surface.label}>
        {option.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: {
    backgroundColor: Surface.label,
    borderColor: Surface.label,
  },
  chipInactive: {
    backgroundColor: Surface.card,
    borderColor: Surface.border,
  },
});

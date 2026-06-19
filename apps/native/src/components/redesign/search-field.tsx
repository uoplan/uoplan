import { StyleSheet, TextInput, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Fonts, Surface } from "@/constants/theme";

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

/** Rounded search input with a leading magnifier, matching the web mobile
 *  explore search box (mono placeholder, hairline border, paper fill). */
export function SearchField({ value, onChangeText, placeholder }: SearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <AppIcon name="magnifyingglass" size={18} color={Surface.dimmed} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search by code or title…"}
        placeholderTextColor={Surface.dimmed}
        style={styles.input}
        numberOfLines={1}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Surface.label,
    padding: 0,
  },
});

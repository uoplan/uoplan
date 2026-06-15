import { Pressable, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { TabsProps } from "./Tabs.types";

const BORDER_COLOR = NativeColors.border;
const ACTIVE = NativeColors.text;
const INACTIVE = NativeColors.textMuted;

/** Native (React Native) implementation of the Tabs contract. */
export function Tabs({ value, onChange, items, testID }: TabsProps) {
  const active = items.find((item) => item.value === value) ?? items[0];
  return (
    <View testID={testID}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER_COLOR }}>
        {items.map((item) => {
          const isActive = item.value === value;
          return (
            <Pressable
              key={item.value}
              onPress={() => onChange(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? ACTIVE : "transparent",
              }}
            >
              <RNText
                style={{
                  color: isActive ? ACTIVE : INACTIVE,
                  fontSize: 14,
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {item.label}
              </RNText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ paddingTop: 12 }}>{active?.content}</View>
    </View>
  );
}

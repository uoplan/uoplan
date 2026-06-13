import { Pressable, Text as RNText, View } from "react-native";

import type { RadioProps } from "./Radio.types";

const ACCENT = "#3673cb";
const BORDER_COLOR = "#d2cdc2";
const LABEL_COLOR = "#2a2826";
const GROUP_LABEL_COLOR = "#5e5a52";

/** Native (React Native) implementation of the Radio contract. */
export function Radio({ value, onChange, data, label, disabled, testID }: RadioProps) {
  return (
    <View testID={testID} style={{ gap: 8 }}>
      {label ? <RNText style={{ color: GROUP_LABEL_COLOR, fontSize: 14 }}>{label}</RNText> : null}
      {data.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!disabled) onChange?.(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: selected ? ACCENT : BORDER_COLOR,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: ACCENT,
                  }}
                />
              ) : null}
            </View>
            <RNText style={{ color: LABEL_COLOR, fontSize: 14 }}>{option.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

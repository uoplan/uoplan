import { useState } from "react";
import { Pressable, Modal as RNModal, Text as RNText, View } from "react-native";

import type { SelectProps } from "./Select.types";

const BACKDROP = "rgba(0, 0, 0, 0.35)";
const SURFACE_BG = "#fffdfa";
const BORDER_COLOR = "#d2cdc2";
const PANEL_BORDER = "#ebe6dd";
const LABEL = "#2a2826";
const DIMMED = "#5e5a52";
const PLACEHOLDER = "#9aa0a6";
const ACCENT = "#2f5fa6";

/** Native (React Native) implementation of the Select contract. */
export function Select({
  value,
  onChange,
  data,
  label,
  placeholder,
  disabled,
  testID,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = data.find((option) => option.value === value);

  return (
    <View style={{ gap: 4 }}>
      {label ? <RNText style={{ color: DIMMED, fontSize: 14 }}>{label}</RNText> : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: SURFACE_BG,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <RNText style={{ color: selected ? LABEL : PLACEHOLDER, fontSize: 15 }}>
          {selected ? selected.label : (placeholder ?? "Select…")}
        </RNText>
      </Pressable>
      <RNModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: BACKDROP,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: SURFACE_BG,
              borderWidth: 1,
              borderColor: PANEL_BORDER,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {data.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: PANEL_BORDER,
                  }}
                >
                  <RNText
                    style={{
                      color: isSelected ? ACCENT : LABEL,
                      fontSize: 15,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {option.label}
                  </RNText>
                  {isSelected ? <RNText style={{ color: ACCENT, fontSize: 15 }}>✓</RNText> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

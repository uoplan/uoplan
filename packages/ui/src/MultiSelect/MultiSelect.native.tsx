import { useState } from "react";
import { Pressable, Modal as RNModal, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { MultiSelectProps } from "./MultiSelect.types";

const BACKDROP = NativeColors.scrim;
const SURFACE_BG = NativeColors.surface;
const BORDER_COLOR = NativeColors.borderStrong;
const PANEL_BORDER = NativeColors.border;
const LABEL = NativeColors.text;
const DIMMED = NativeColors.textMuted;
const PLACEHOLDER = NativeColors.textDim;
const ACCENT = NativeColors.accent;

/** Native (React Native) implementation of the MultiSelect contract. */
export function MultiSelect({
  value,
  onChange,
  data,
  label,
  placeholder,
  disabled,
  testID,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedValues = value ?? [];
  const selectedLabels = data
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  const toggle = (optionValue: string) => {
    const next = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];
    onChange?.(next);
  };

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
        <RNText style={{ color: selectedLabels.length > 0 ? LABEL : PLACEHOLDER, fontSize: 15 }}>
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : (placeholder ?? "Select…")}
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
              const isSelected = selectedValues.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => toggle(option.value)}
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

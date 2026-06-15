import { useState } from "react";
import { Pressable, Modal as RNModal, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { MenuProps } from "./Menu.types";

const BACKDROP = NativeColors.scrim;
const SURFACE_BG = NativeColors.surface;
const BORDER_COLOR = NativeColors.border;
const LABEL = NativeColors.text;

/** Native (React Native) implementation of the Menu contract. */
export function Menu({ target, items, testID }: MenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>{target}</Pressable>
      <RNModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        testID={testID}
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
          {/* Stop propagation so taps inside the panel don't dismiss it. */}
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: SURFACE_BG,
              borderWidth: 1,
              borderColor: BORDER_COLOR,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                onPress={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: BORDER_COLOR,
                }}
              >
                <RNText style={{ color: LABEL, fontSize: 15 }}>{item.label}</RNText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

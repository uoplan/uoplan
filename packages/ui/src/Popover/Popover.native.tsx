import { Pressable, Modal as RNModal, View } from "react-native";

import type { PopoverProps } from "./Popover.types";

const BACKDROP = "rgba(0, 0, 0, 0.35)";
const SURFACE_BG = "#fffdfa";
const BORDER_COLOR = "#ebe6dd";

/** Native (React Native) implementation of the Popover contract. */
export function Popover({ opened, onChange, target, children, testID }: PopoverProps) {
  return (
    <View>
      {target}
      <RNModal
        visible={opened}
        transparent
        animationType="fade"
        onRequestClose={() => onChange(false)}
        testID={testID}
      >
        <Pressable
          onPress={() => onChange(false)}
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
              maxWidth: 360,
              backgroundColor: SURFACE_BG,
              borderWidth: 1,
              borderColor: BORDER_COLOR,
              borderRadius: 12,
              padding: 16,
              gap: 8,
            }}
          >
            {children}
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

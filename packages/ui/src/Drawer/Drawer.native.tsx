import { Pressable, Modal as RNModal, Text as RNText, View } from "react-native";

import type { DrawerPosition, DrawerProps } from "./Drawer.types";

const BACKDROP = "rgba(0, 0, 0, 0.45)";
const SURFACE_BG = "#fffdfa";
const BORDER_COLOR = "#ebe6dd";
const TITLE_COLOR = "#2a2826";

type Axis = "row" | "column";

function outerLayout(position: DrawerPosition): {
  flexDirection: Axis;
  justifyContent: "flex-start" | "flex-end";
} {
  switch (position) {
    case "left":
      return { flexDirection: "row", justifyContent: "flex-start" };
    case "top":
      return { flexDirection: "column", justifyContent: "flex-start" };
    case "bottom":
      return { flexDirection: "column", justifyContent: "flex-end" };
    default:
      return { flexDirection: "row", justifyContent: "flex-end" };
  }
}

/** Native (React Native) implementation of the Drawer contract. */
export function Drawer({
  opened,
  onClose,
  title,
  position = "right",
  children,
  testID,
}: DrawerProps) {
  const { flexDirection, justifyContent } = outerLayout(position);
  const isHorizontal = position === "left" || position === "right";
  const animationType = position === "bottom" ? "slide" : "fade";

  return (
    <RNModal
      visible={opened}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: BACKDROP, flexDirection, justifyContent }}
      >
        {/* Stop propagation so taps inside the panel don't dismiss the drawer. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: SURFACE_BG,
            padding: 20,
            gap: 12,
            ...(isHorizontal
              ? { height: "100%", width: "80%", maxWidth: 420 }
              : { width: "100%", maxHeight: "70%" }),
          }}
        >
          {title ? (
            <View
              style={{ borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, paddingBottom: 10 }}
            >
              <RNText style={{ color: TITLE_COLOR, fontSize: 18, fontWeight: "700" }}>
                {title}
              </RNText>
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

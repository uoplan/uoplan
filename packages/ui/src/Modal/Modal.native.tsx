import { Pressable, Modal as RNModal, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { ModalProps } from "./Modal.types";

const BACKDROP = NativeColors.scrim;
const SURFACE_BG = NativeColors.surface;
const TITLE_COLOR = NativeColors.text;
const BORDER_COLOR = NativeColors.border;

/** Native (React Native) implementation of the Modal contract. */
export function Modal({ opened, onClose, title, children, testID }: ModalProps) {
  return (
    <RNModal
      visible={opened}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: BACKDROP,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Stop propagation so taps inside the card don't dismiss the modal. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: SURFACE_BG,
            borderRadius: 16,
            padding: 20,
            gap: 12,
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

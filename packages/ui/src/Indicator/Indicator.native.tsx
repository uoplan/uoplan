import { Text as RNText, View } from "react-native";

import { BADGE_TONES } from "../Badge/tones";
import type { IndicatorPosition, IndicatorProps } from "./Indicator.types";

const OFFSET = -4;

const POSITION_STYLE: Record<IndicatorPosition, object> = {
  "top-start": { top: OFFSET, left: OFFSET },
  "top-end": { top: OFFSET, right: OFFSET },
  "bottom-start": { bottom: OFFSET, left: OFFSET },
  "bottom-end": { bottom: OFFSET, right: OFFSET },
};

/** Native (React Native) implementation of the Indicator contract. */
export function Indicator({
  children,
  label,
  tone = "danger",
  position = "top-end",
  disabled,
  testID,
}: IndicatorProps) {
  const colors = BADGE_TONES[tone];
  const hasLabel = label != null;
  return (
    <View testID={testID} style={{ position: "relative", alignSelf: "flex-start" }}>
      {children}
      {!disabled && (
        <View
          style={[
            {
              position: "absolute",
              minWidth: hasLabel ? 16 : 10,
              height: hasLabel ? 16 : 10,
              borderRadius: 999,
              backgroundColor: colors.fg,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: hasLabel ? 4 : 0,
            },
            POSITION_STYLE[position],
          ]}
        >
          {hasLabel && (
            <RNText style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>{label}</RNText>
          )}
        </View>
      )}
    </View>
  );
}

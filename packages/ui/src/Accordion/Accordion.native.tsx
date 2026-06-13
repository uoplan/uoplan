import { useState } from "react";
import { Pressable, Text as RNText, View } from "react-native";

import type { AccordionProps } from "./Accordion.types";

const BORDER_COLOR = "#ebe6dd";
const LABEL = "#2a2826";
const DIMMED = "#5e5a52";

/** Native (React Native) implementation of the Accordion contract. */
export function Accordion({ items, multiple, defaultOpen = [], testID }: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultOpen);

  const toggle = (value: string) => {
    setOpen((prev) => {
      if (prev.includes(value)) return prev.filter((entry) => entry !== value);
      return multiple ? [...prev, value] : [value];
    });
  };

  return (
    <View
      testID={testID}
      style={{ borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 12, overflow: "hidden" }}
    >
      {items.map((item, index) => {
        const isOpen = open.includes(item.value);
        return (
          <View
            key={item.value}
            style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: BORDER_COLOR }}
          >
            <Pressable
              onPress={() => toggle(item.value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 14,
              }}
            >
              <RNText style={{ color: LABEL, fontSize: 15, fontWeight: "600" }}>
                {item.label}
              </RNText>
              <RNText
                style={{
                  color: DIMMED,
                  fontSize: 16,
                  transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
                }}
              >
                ›
              </RNText>
            </Pressable>
            {isOpen && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{item.content}</View>
            )}
          </View>
        );
      })}
    </View>
  );
}

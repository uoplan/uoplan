import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?: "default" | "title" | "small" | "smallBold" | "subtitle" | "link" | "linkPrimary" | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = "default", themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? "text"] },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "linkPrimary" && styles.linkPrimary,
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 44,
    lineHeight: 50,
  },
  subtitle: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 40,
  },
  link: {
    fontFamily: Fonts.mono,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.mono,
    lineHeight: 30,
    fontSize: 14,
    color: "#3673cb",
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});

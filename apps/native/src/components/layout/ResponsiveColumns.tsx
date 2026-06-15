import { Children, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Spacing } from "@/constants/theme";
import type { AdaptiveLayout } from "@/lib/adaptive-layout";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";

interface ResponsiveColumnsProps {
  children: ReactNode;
  /** Maximum columns to use at regular width. Compact width always renders one column. */
  maxColumns?: 1 | 2;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function resolveResponsiveColumnCount(
  layout: Pick<AdaptiveLayout, "columns">,
  maxColumns: 1 | 2 = 2,
): 1 | 2 {
  return layout.columns === 2 && maxColumns === 2 ? 2 : 1;
}

export function ResponsiveColumns({
  children,
  maxColumns = 2,
  gap = Spacing.three,
  style,
  columnStyle,
  testID,
}: ResponsiveColumnsProps) {
  const layout = useAdaptiveLayout();
  const columns = resolveResponsiveColumnCount(layout, maxColumns);
  if (columns === 1) {
    return <>{children}</>;
  }

  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  return (
    <View testID={testID} style={[styles.container, { gap }, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap }]}>
          {row.map((child, columnIndex) => (
            <View key={columnIndex} style={[styles.column, columnStyle]}>
              {child}
            </View>
          ))}
          {row.length < columns ? <View style={styles.column} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
});

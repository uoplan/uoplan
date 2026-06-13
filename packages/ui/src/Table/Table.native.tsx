import { Text as RNText, View } from "react-native";
import type { ReactNode } from "react";

import type { TableProps } from "./Table.types";

const BORDER_COLOR = "#ebe6dd";
const HEADER_BG = "#f7f4ef";
const HEADER_FG = "#5e5a52";
const CELL_FG = "#2a2826";

function renderCell(value: ReactNode) {
  if (typeof value === "string" || typeof value === "number") {
    return <RNText style={{ color: CELL_FG, fontSize: 13 }}>{value}</RNText>;
  }
  return value;
}

/** Native (React Native) implementation of the Table contract. */
export function Table({ columns, rows, testID }: TableProps) {
  return (
    <View
      testID={testID}
      style={{ borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", backgroundColor: HEADER_BG }}>
        {columns.map((column) => (
          <View key={column.key} style={{ flex: 1, padding: 8 }}>
            <RNText style={{ color: HEADER_FG, fontSize: 12, fontWeight: "600" }}>
              {column.header}
            </RNText>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER_COLOR }}
        >
          {columns.map((column) => (
            <View key={column.key} style={{ flex: 1, padding: 8 }}>
              {renderCell(row[column.key])}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

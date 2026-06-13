import type { ReactNode } from "react";

/**
 * Shared prop contract for the Table primitive — a simple columnar data table.
 * Web maps onto Mantine's compound `Table`; native onto flexbox rows. The
 * `columns` + `rows` model (each row maps a column key to a cell node) keeps the
 * API platform-neutral and avoids exposing a compound component API.
 */
export interface TableColumn {
  /** Stable identifier; also the key used to look up each row's cell. */
  key: string;
  /** Column header label. */
  header: string;
}

export interface TableProps {
  columns: TableColumn[];
  /** One record per row, mapping each column `key` to a cell node. */
  rows: Array<Record<string, ReactNode>>;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

import type { ReactNode } from "react";
import { Box } from "@mantine/core";

export interface CompareColumn {
  key: string;
  header: ReactNode;
}

export interface CompareRow {
  key: string;
  label: string;
  /** One cell per column, aligned by index with {@link CompareColumn}. */
  cells: ReactNode[];
}

/**
 * Generic side-by-side comparison grid: a sticky leftmost label column plus one
 * column per compared entity. Horizontally scrollable on narrow viewports so the
 * columns degrade to a swipeable strip rather than cramping. Resource-agnostic —
 * the course (and future professor/discipline) views build `columns`/`rows`.
 */
export function CompareGrid({ columns, rows }: { columns: CompareColumn[]; rows: CompareRow[] }) {
  return (
    <Box style={{ overflowX: "auto", paddingBottom: 8 }}>
      <Box
        component="table"
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          width: "100%",
          minWidth: 320 + columns.length * 200,
        }}
      >
        <Box component="thead">
          <Box component="tr">
            <Box
              component="th"
              style={{
                position: "sticky",
                left: 0,
                zIndex: 2,
                background: "var(--app-bg)",
                textAlign: "left",
                verticalAlign: "bottom",
                padding: "8px 12px",
                minWidth: 140,
              }}
            />
            {columns.map((col) => (
              <Box
                component="th"
                key={col.key}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  verticalAlign: "bottom",
                  minWidth: 200,
                  borderBottom: "var(--app-border-width) solid var(--app-border-strong)",
                }}
              >
                {col.header}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <Box component="tr" key={row.key}>
              <Box
                component="th"
                scope="row"
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  background: "var(--app-bg)",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: "var(--mantine-font-size-sm)",
                  color: "var(--app-text-dimmed)",
                  padding: "12px",
                  verticalAlign: "top",
                  borderBottom: "var(--app-border-width) solid var(--app-border)",
                }}
              >
                {row.label}
              </Box>
              {row.cells.map((cell, i) => (
                <Box
                  component="td"
                  key={columns[i]?.key ?? i}
                  style={{
                    padding: "12px",
                    verticalAlign: "top",
                    fontSize: "var(--mantine-font-size-sm)",
                    color: "var(--app-text)",
                    borderBottom: "var(--app-border-width) solid var(--app-border)",
                  }}
                >
                  {cell}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

import { Table as MantineTable } from "@mantine/core";

import type { TableProps } from "./Table.types";

/** Web (Mantine) implementation of the Table contract. */
export function Table({ columns, rows, testID }: TableProps) {
  return (
    <MantineTable data-testid={testID}>
      <MantineTable.Thead>
        <MantineTable.Tr>
          {columns.map((column) => (
            <MantineTable.Th key={column.key}>{column.header}</MantineTable.Th>
          ))}
        </MantineTable.Tr>
      </MantineTable.Thead>
      <MantineTable.Tbody>
        {rows.map((row, rowIndex) => (
          <MantineTable.Tr key={rowIndex}>
            {columns.map((column) => (
              <MantineTable.Td key={column.key}>{row[column.key]}</MantineTable.Td>
            ))}
          </MantineTable.Tr>
        ))}
      </MantineTable.Tbody>
    </MantineTable>
  );
}

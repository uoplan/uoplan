/**
 * Thin exceljs wrapper used by the grades converter.
 *
 * Reads the first worksheet of an `.xlsx` into a dense `string[][]` grid (every
 * cell stringified, blanks preserved positionally) so the pure converter in
 * `xlsxToCsv.ts` can do header detection + column mapping without knowing about
 * exceljs. Excel ownership/lock files (`~$*.xlsx`) are skipped.
 */

import fs from "node:fs/promises";
import ExcelJS from "exceljs";

/** Stringify a single cell, flattening rich text / formula results to plain text. */
function cellToString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("");
    }
    if ("result" in obj) {
      const result = obj.result;
      if (result == null) return "";
      if (typeof result === "string") return result;
      if (typeof result === "number" || typeof result === "boolean") return String(result);
      if (result instanceof Date) return result.toISOString();
      return ""; // formula error object or other non-primitive result
    }
    if ("text" in obj && typeof obj.text === "string") return obj.text;
  }
  // Fall back to exceljs' own formatted text representation.
  return typeof cell.text === "string" ? cell.text : "";
}

/** Read the first worksheet of an `.xlsx` file into a dense grid of strings. */
export async function readXlsxRows(filePath: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const columnCount = sheet.columnCount;
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= columnCount; c++) cells.push(cellToString(row.getCell(c)));
    rows.push(cells);
  });
  return rows;
}

/** List real `*.xlsx` files in a directory, skipping Excel lock files (`~$*`). */
export async function listXlsxFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    throw new Error(
      `xlsx source directory not found: ${dir}. Place the registrar Excel exports there.`,
    );
  }
  return entries.filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$")).sort();
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseListRows, parseResultsRange, parseTotalReports } from "./list.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = await fs.readFile(path.join(__dirname, "__fixtures__", "reportlist.html"), "utf-8");

describe("parseTotalReports", () => {
  it("reads the total item count from the listing footer", () => {
    expect(parseTotalReports(html)).toBe(3309);
  });

  it("returns null when absent", () => {
    expect(parseTotalReports("<html></html>")).toBeNull();
  });
});

describe("parseResultsRange", () => {
  it("reads the from/to/total from the listing footer", () => {
    expect(parseResultsRange(html)).toEqual({ from: 1, to: 10, total: 3309 });
  });

  it("parses comma-grouped numbers", () => {
    const range = parseResultsRange("Results: 3,201 - 3,210 of 3,309 Item(s)");
    expect(range).toEqual({ from: 3201, to: 3210, total: 3309 });
  });

  it("returns null when absent", () => {
    expect(parseResultsRange("<html></html>")).toBeNull();
  });
});

describe("parseListRows", () => {
  const rows = parseListRows(html);
  const clickable = rows.filter((r) => r.reportId !== null);
  const disabled = rows.filter((r) => r.reportId === null);

  it("extracts clickable report rows with a hash id, href and title", () => {
    expect(clickable.length).toBeGreaterThan(0);
    const first = clickable[0];
    expect(first.reportId).toMatch(/^[a-f0-9]{16,}$/);
    expect(first.href).toContain("SelectedIDforPrint=");
    expect(first.title).toContain("Course Evaluation Report for");
  });

  it("includes ineligible (disabled) rows with no id/href but a title", () => {
    expect(disabled.length).toBeGreaterThan(0);
    for (const r of disabled) {
      expect(r.reportId).toBeNull();
      expect(r.href).toBeNull();
      expect(r.title).toContain("Course Evaluation Report for");
    }
  });

  it("strips the link-icon span from the title", () => {
    for (const r of rows) {
      expect(r.title).not.toContain("linkIcon");
    }
  });

  it("returns one row per rendered report (no over-deduping)", () => {
    const titlePhrases = (html.match(/Course Evaluation Report for/g) ?? []).length;
    expect(rows.length).toBe(titlePhrases);
  });
});

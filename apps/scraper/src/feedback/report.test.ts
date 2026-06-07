import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseReport } from "./report.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = await fs.readFile(path.join(__dirname, "__fixtures__", "report-modern.html"), "utf-8");

describe("parseReport", () => {
  const { questions } = parseReport(html);

  it("parses every question block", () => {
    expect(questions.length).toBe(16);
  });

  it("captures the first question's stats and chart", () => {
    const q1 = questions[0];
    expect(q1.question).toContain("For your program, this course is");
    expect(q1.registeredStudents).toBe(27);
    expect(q1.responses).toBe(11);
    expect(q1.chartUrl).toMatch(/ChartPic_.*\.png$/);
  });

  it("captures Average and Standard Deviation when present", () => {
    const withMean = questions.find((q) => q.average !== null);
    expect(withMean).toBeDefined();
    expect(withMean?.average).toBeGreaterThan(0);
    expect(withMean?.standardDeviation).not.toBeNull();
  });
});

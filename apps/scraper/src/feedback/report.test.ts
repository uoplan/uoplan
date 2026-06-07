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

  it("leaves options empty for modern (chart-only) reports", () => {
    expect(questions.every((q) => q.options.length === 0)).toBe(true);
  });
});

describe("parseReport frequency distribution (older HTML-table reports)", () => {
  const block = `
    <div class="report-block">
      <h4 class="ReportBlockTitle"><span>1) I find the professor well prepared for class</span></h4>
      <div class="FrequencyBlock_table">
        <table summary="Frequency">
          <tbody>
            <tr><th class="TabularBody_LeftColumn" id="scale_0" headers="FreqOptions">A: almost always</th>
                <td class="TabularBody_MiddleColumn_NoWrap" headers="FreqCount scale_0">16</td>
                <td class="TabularBody_MiddleColumn_NoWrap" headers="FreqPercentage scale_0">50%</td></tr>
            <tr><th class="TabularBody_LeftColumn" id="scale_1" headers="FreqOptions">B: often</th>
                <td class="TabularBody_MiddleColumn_NoWrap" headers="FreqCount scale_1">13</td>
                <td class="TabularBody_MiddleColumn_NoWrap" headers="FreqPercentage scale_1">41%</td></tr>
          </tbody>
        </table>
        <table summary="Statistics">
          <tbody>
            <tr><th class="TabularBody_LeftColumn" id="Total" headers="statisticHeader">Number of responses</th>
                <td class="TabularBody_RightColumn_NoWrap" headers="statValueID Total">32</td></tr>
            <tr><th class="TabularBody_LeftColumn" id="Mean" headers="statisticHeader">Average</th>
                <td class="TabularBody_RightColumn_NoWrap" headers="statValueID Mean">4.41</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  it("strips the question number and the answer letter", () => {
    const { questions } = parseReport(block);
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.question).toBe("I find the professor well prepared for class");
    expect(q.responses).toBe(32);
    expect(q.average).toBe(4.41);
    expect(q.options).toEqual([
      { label: "almost always", count: 16, percentage: 50 },
      { label: "often", count: 13, percentage: 41 },
    ]);
  });
});

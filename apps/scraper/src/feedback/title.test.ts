import { describe, expect, it } from "vitest";
import { parseCourses, parseReportTitle } from "./title.ts";

describe("parseReportTitle", () => {
  it("parses a single-course English title", () => {
    expect(
      parseReportTitle(
        "Course Evaluation Report for Abbot, Helen (FEM1100 B00 Women, Gender, Feminism: An Introduction)",
      ),
    ).toEqual({
      professor: "Helen Abbot",
      courses: [
        { code: "FEM 1100", section: "B00", title: "Women, Gender, Feminism: An Introduction" },
      ],
    });
  });

  it("normalizes a multi-word last name and a non-letter section", () => {
    expect(
      parseReportTitle(
        "Course Evaluation Report for Abdinur, Suad (NSG3137 NG00 Practicum: Mental Health)",
      ),
    ).toEqual({
      professor: "Suad Abdinur",
      courses: [{ code: "NSG 3137", section: "NG00", title: "Practicum: Mental Health" }],
    });
  });

  it("splits multiple courses even when titles contain commas", () => {
    const parsed = parseReportTitle(
      "Course Evaluation Report for Smith, John (ELG5301 A00 Professional Skills, and Responsibility, GNG5301 A00 Professional Skills and Responsibility)",
    );
    expect(parsed?.courses).toEqual([
      { code: "ELG 5301", section: "A00", title: "Professional Skills, and Responsibility" },
      { code: "GNG 5301", section: "A00", title: "Professional Skills and Responsibility" },
    ]);
  });

  it("parses a French portal title", () => {
    expect(
      parseReportTitle(
        "Rapport d'evaluation de cours pour Abanto Rojas, Luis Alexander (LCM1501 A00 Comment apprendre les langues etrangeres)",
      ),
    ).toEqual({
      professor: "Luis Alexander Abanto Rojas",
      courses: [
        { code: "LCM 1501", section: "A00", title: "Comment apprendre les langues etrangeres" },
      ],
    });
  });

  it("returns null when there is no parenthesized course block", () => {
    expect(parseReportTitle("Some unrelated link text")).toBeNull();
  });
});

describe("parseCourses", () => {
  it("handles a code written with an internal space", () => {
    expect(parseCourses("ITI 1120 A00 Programming and Problem Solving")).toEqual([
      { code: "ITI 1120", section: "A00", title: "Programming and Problem Solving" },
    ]);
  });
});

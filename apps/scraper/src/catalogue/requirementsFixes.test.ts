import { describe, expect, it } from "vitest";

import { processRequirements } from "./requirements.ts";
import type { ProgramRequirement } from "./schema.ts";

describe("processRequirements catalogue fixes", () => {
  it("keeps non-indented option children inside their option branch", () => {
    const flat: ProgramRequirement[] = [
      { type: "section", title: "Coursework or Project" },
      { type: "group", title: "One option from the following:", credits: 9, options: [] },
      { type: "section", title: "Option 1:" },
      { type: "course", code: "BMG 6000", credits: 6 },
      { type: "elective", title: "3 elective course units at the graduate level", credits: 3 },
      { type: "section", title: "Seminar" },
      { type: "course", code: "BMG 6996" },
    ];

    expect(processRequirements(flat)).toEqual([
      {
        type: "and",
        title: "Coursework or Project",
        options: [
          {
            type: "options_group",
            title: "One option from the following:",
            credits: 9,
            options: [
              {
                type: "and",
                title: "Option 1:",
                options: [
                  { type: "course", code: "BMG 6000", credits: 6 },
                  {
                    type: "elective",
                    title: "3 elective course units at the graduate level",
                    credits: 3,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "and",
        title: "Seminar",
        options: [{ type: "course", code: "BMG 6996" }],
      },
    ]);
  });

  it("starts new option branches from non-section option headers and the Opiton typo", () => {
    const flat: ProgramRequirement[] = [
      { type: "group", title: "One option from the following:", options: [] },
      { type: "elective", title: "Option 1:" },
      {
        type: "discipline_elective",
        title: "9 optional course units in economics (ECO)",
        credits: 9,
      },
      { type: "elective", title: "Opiton 2:" },
      { type: "course", code: "ECO 3150", credits: 3 },
    ];

    expect(processRequirements(flat)).toEqual([
      {
        type: "options_group",
        title: "One option from the following:",
        options: [
          {
            type: "and",
            title: "Option 1:",
            options: [
              {
                type: "discipline_elective",
                title: "9 optional course units in economics (ECO)",
                credits: 9,
              },
            ],
          },
          {
            type: "and",
            title: "Opiton 2:",
            options: [{ type: "course", code: "ECO 3150", credits: 3 }],
          },
        ],
      },
    ]);
  });

  it("nests term sections under year parent sections", () => {
    const flat: ProgramRequirement[] = [
      { type: "section", title: "YEAR 1" },
      { type: "section", title: "Fall Term" },
      { type: "course", code: "PSY 4130", credits: 3 },
      { type: "section", title: "Winter Term" },
      { type: "course", code: "PSY 5102", credits: 3 },
      { type: "section", title: "YEAR 2" },
      { type: "course", code: "PSY 7103", credits: 3 },
    ];

    expect(processRequirements(flat)).toEqual([
      {
        type: "and",
        title: "YEAR 1",
        options: [
          {
            type: "and",
            title: "Fall Term",
            options: [{ type: "course", code: "PSY 4130", credits: 3 }],
          },
          {
            type: "and",
            title: "Winter Term",
            options: [{ type: "course", code: "PSY 5102", credits: 3 }],
          },
        ],
      },
      {
        type: "and",
        title: "YEAR 2",
        options: [{ type: "course", code: "PSY 7103", credits: 3 }],
      },
    ]);
  });
});

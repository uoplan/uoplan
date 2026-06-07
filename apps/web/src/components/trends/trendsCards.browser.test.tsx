import { describe, expect, it } from "vitest";
import type { CourseGradesData } from "@uoplan/core";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { TrendsCardContext } from "./cardContext";
import { DisciplineBarCard } from "./DisciplineBarCard";
import { DisciplineHeatmapCard } from "./DisciplineHeatmapCard";
import { GradeBandAreaCard } from "./GradeBandAreaCard";
import { GradeHistogramCard } from "./GradeHistogramCard";
import { LevelBarCard } from "./LevelBarCard";
import { ProfessorSpreadCard } from "./ProfessorSpreadCard";
import { SeasonBarCard } from "./SeasonBarCard";
import { VolumeGpaScatterCard } from "./VolumeGpaScatterCard";

/** Minimal multi-discipline / multi-term grades fixture for render smoke tests. */
const grades: CourseGradesData = {
  courses: [
    {
      code: "CSI 1101",
      professors: [
        { name: "Easy", termId: 2239, distribution: { "A+": 80, A: 20 } },
        { name: "Hard", termId: 2241, distribution: { C: 60, D: 40 } },
        { name: "Easy", termId: 2249, distribution: { A: 70, B: 30 } },
      ],
    },
    {
      code: "CSI 2110",
      professors: [{ name: "Mid", termId: 2249, distribution: { B: 50, "B+": 30, F: 20 } }],
    },
    {
      code: "PSY 1101",
      professors: [
        { name: "Kind", termId: 2239, distribution: { A: 100 } },
        { name: "Kind", termId: 2249, distribution: { A: 90, "A-": 10 } },
      ],
    },
  ],
};

const context: TrendsCardContext = {
  grades,
  discipline: null,
  level: null,
  season: null,
  programFilter: null,
  metric: "gpa",
  metricLabel: "GPA",
};

const scopedContext: TrendsCardContext = { ...context, discipline: "CSI" };

describe("trends chart cards", () => {
  it("renders every card without throwing", async () => {
    const { container } = await renderWithProviders(
      <>
        <DisciplineBarCard {...context} />
        <DisciplineHeatmapCard {...context} />
        <GradeBandAreaCard {...scopedContext} />
        <GradeHistogramCard {...scopedContext} />
        <SeasonBarCard {...scopedContext} />
        <LevelBarCard {...scopedContext} />
        <VolumeGpaScatterCard {...scopedContext} />
        <ProfessorSpreadCard {...scopedContext} />
      </>,
    );
    expect(container.querySelectorAll("section, div").length).toBeGreaterThan(0);
  });
});

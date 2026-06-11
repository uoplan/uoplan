import { describe, expect, it } from "vitest";
import type { FeedbackProto } from "@uoplan/proto";
import { normalizeCourseCode } from "../utils/courseUtils";
import {
  buildFeedbackIndex,
  feedbackAllViews,
  feedbackOverallSeries,
  feedbackQuestionSeries,
  feedbackResponseRateSeries,
  feedbackSummary,
} from "../feedback";

// Minimal hand-built FeedbackData: two terms of CSI 2110, one scale question
// ("clarity") plus one categorical question ("program fit", scale=false).
function sampleData(): FeedbackProto.FeedbackData {
  return {
    questions: [
      { text: "The instructor explained clearly", scale: true, optionSet: 1 },
      { text: "For your program, this course is", scale: false, optionSet: 0 },
    ],
    professors: ["Ada Lovelace", "Alan Turing"],
    extraCourses: [normalizeCourseCode("XYZ 9999")],
    indicesCourseCount: 2,
    questionSets: [{ questions: [0, 1] }],
    optionSets: [{ options: ["strongly agree", "agree", "disagree", "strongly disagree"] }],
    terms: [
      {
        termId: 2231,
        courses: [
          {
            course: 0, // -> indicesCourses[0]
            sections: [
              {
                section: "A00",
                professor: 0,
                questionSet: 0,
                responses: [40, 38],
                registered: [50, 50],
                averages: [42, 0], // 4.2 for scale q; categorical absent
              },
            ],
          },
          {
            course: 2, // -> extraCourses[0]  (2 - indicesCourseCount(2) = 0)
            sections: [
              {
                section: "B00",
                professor: 1,
                questionSet: 0,
                responses: [10, 9],
                registered: [],
                averages: [30, 0],
              },
            ],
          },
        ],
      },
      {
        termId: 2241,
        courses: [
          {
            course: 0,
            sections: [
              {
                section: "A00",
                professor: 0,
                questionSet: 0,
                responses: [20, 20],
                registered: [40, 40],
                averages: [48, 0], // 4.8
              },
            ],
          },
        ],
      },
    ],
  } as unknown as FeedbackProto.FeedbackData;
}

const INDICES = [normalizeCourseCode("CSI 2110"), normalizeCourseCode("MAT 1320")];

describe("buildFeedbackIndex", () => {
  it("resolves shared-index and extra course codes and decodes averages", () => {
    const index = buildFeedbackIndex(sampleData(), INDICES);

    expect(index.questions).toHaveLength(2);
    expect(index.questions[0].scale).toBe(true);
    expect(index.questions[1].scale).toBe(false);
    // option_set (1-based) resolves to its label set, best-first; 0 -> no labels.
    expect(index.questions[0].options).toEqual([
      "strongly agree",
      "agree",
      "disagree",
      "strongly disagree",
    ]);
    expect(index.questions[1].options).toEqual([]);

    const csi = index.byCourseNorm.get(normalizeCourseCode("CSI 2110"));
    expect(csi).toBeDefined();
    expect(csi).toHaveLength(2); // one per term

    const first = csi!.find((v) => v.termId === 2231)!;
    expect(first.professorName).toBe("Ada Lovelace");
    expect(first.registered).toBe(50);
    expect(first.questions[0].average).toBeCloseTo(4.2);
    expect(first.questions[1].average).toBeNull(); // categorical -> null

    // extra_courses overflow code resolves too.
    expect(index.byCourseNorm.get(normalizeCourseCode("XYZ 9999"))).toHaveLength(1);
    const extra = index.byCourseNorm.get(normalizeCourseCode("XYZ 9999"))![0];
    expect(extra.registered).toBeNull(); // empty registered array
    expect(extra.questions[0].average).toBeCloseTo(3.0);
  });

  it("normalizes whitespace in course codes", () => {
    const index = buildFeedbackIndex(sampleData(), ["csi  2110", normalizeCourseCode("MAT 1320")]);
    expect(index.byCourseNorm.has(normalizeCourseCode("CSI 2110"))).toBe(true);
  });
});

describe("feedback aggregation helpers", () => {
  it("builds a response-weighted per-question series over terms", () => {
    const index = buildFeedbackIndex(sampleData(), INDICES);
    const views = index.byCourseNorm.get(normalizeCourseCode("CSI 2110"))!;
    const series = feedbackQuestionSeries(views, index.questions);

    // Only the scale question is charted.
    expect(series).toHaveLength(1);
    expect(series[0].questionId).toBe(0);
    expect(series[0].points.map((p) => p.termId)).toEqual([2231, 2241]);
    expect(series[0].points[0].average).toBeCloseTo(4.2);
    expect(series[0].points[1].average).toBeCloseTo(4.8);
  });

  it("summarizes overall sentiment, responses and response rate", () => {
    const index = buildFeedbackIndex(sampleData(), INDICES);
    const views = index.byCourseNorm.get(normalizeCourseCode("CSI 2110"))!;
    const summary = feedbackSummary(views);

    // weighted: (4.2*40 + 4.8*20) / 60 = 4.4
    expect(summary.overallAverage).toBeCloseTo(4.4);
    expect(summary.totalResponses).toBe(60); // 40 + 20 (scale question only)
    expect(summary.termsCovered).toBe(2);
    // respondents/registered: (40 + 20) / (50 + 40) = 60/90
    expect(summary.responseRate).toBeCloseTo(60 / 90);
  });

  it("emits a response-rate series only for terms with invited counts", () => {
    const index = buildFeedbackIndex(sampleData(), INDICES);
    const rate = feedbackResponseRateSeries(
      index.byCourseNorm.get(normalizeCourseCode("CSI 2110"))!,
    );
    expect(rate.map((p) => p.termId)).toEqual([2231, 2241]);
    expect(rate[0].rate).toBeCloseTo(40 / 50);

    // The extra course has no registered data -> no rate points.
    expect(
      feedbackResponseRateSeries(index.byCourseNorm.get(normalizeCourseCode("XYZ 9999"))!),
    ).toHaveLength(0);
  });

  it("computes a university-wide overall series across all views", () => {
    const index = buildFeedbackIndex(sampleData(), INDICES);
    const all = feedbackAllViews(index);
    expect(all).toHaveLength(3);

    const overall = feedbackOverallSeries(all);
    const t2231 = overall.find((p) => p.termId === 2231)!;
    // (4.2*40 + 3.0*10) / 50 = 3.96
    expect(t2231.average).toBeCloseTo((4.2 * 40 + 3.0 * 10) / 50);
  });
});

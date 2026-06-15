import { type FeedbackIndex, type FeedbackSectionView } from "@uoplan/core/feedback";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { trendsFeedbackData } from "@/data/feedback-data";

function section(
  termId: number,
  registered: number,
  questions: FeedbackSectionView["questions"],
): FeedbackSectionView {
  return {
    termId,
    section: "A",
    professorName: "Example professor",
    registered,
    questions,
  };
}

function makeIndex(): FeedbackIndex {
  const itiViews: FeedbackSectionView[] = [
    section(2231, 100, [
      { questionId: 0, average: 4, responses: 40, registered: 100 },
      { questionId: 1, average: 3, responses: 20, registered: 100 },
    ]),
    section(2241, 80, [
      { questionId: 0, average: 5, responses: 50, registered: 80 },
      { questionId: 1, average: 4, responses: 30, registered: 80 },
    ]),
  ];
  const matViews: FeedbackSectionView[] = [
    section(2231, 50, [
      { questionId: 0, average: 2, responses: 10, registered: 50 },
      { questionId: 1, average: null, responses: 0, registered: 50 },
    ]),
  ];

  return {
    questions: [
      { text: "The course was well organized", scale: true, options: [] },
      { text: "I learned a lot", scale: true, options: [] },
    ],
    byCourseNorm: new Map([
      [normalizeCourseCode("ITI 1120"), itiViews],
      [normalizeCourseCode("MAT 1320"), matViews],
    ]),
  };
}

describe("trends feedback aggregate view-model", () => {
  it("builds university-wide sentiment, response-rate, and question charts", () => {
    const result = trendsFeedbackData(makeIndex());

    expect(result.sentiment).toEqual([
      { label: "W23", value: 3.43 },
      { label: "W24", value: 4.63 },
    ]);
    expect(result.rate).toEqual([
      { label: "W23", value: 33.3 },
      { label: "W24", value: 62.5 },
    ]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.map((chart) => chart.text)).toEqual([
      "The course was well organized",
      "I learned a lot",
    ]);
    expect(result.questions[0]?.responsesTotal).toBe(100);
    expect(result.questions[0]?.points).toEqual([
      { label: "W23", value: 3.6 },
      { label: "W24", value: 5 },
    ]);
  });
});

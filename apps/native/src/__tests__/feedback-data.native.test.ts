import { type FeedbackIndex, type FeedbackSectionView } from "@uoplan/core/feedback";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  feedbackHeadline,
  feedbackQuestionCharts,
  feedbackRateSeries,
  feedbackSentimentSeries,
  feedbackViewsForCourse,
  feedbackViewsForProfessor,
} from "@/data/feedback-data";

// Two terms of evaluations for one course: two scale questions per section, with
// known averages/responses/registered counts so every headline + series value is
// exactly predictable.
function makeIndex(): FeedbackIndex {
  const views: FeedbackSectionView[] = [
    {
      termId: 2231,
      section: "A",
      professorName: "Alice Smith",
      registered: 100,
      questions: [
        { questionId: 0, average: 4, responses: 50, registered: 100 },
        { questionId: 1, average: 3, responses: 50, registered: 100 },
      ],
    },
    {
      termId: 2241,
      section: "A",
      professorName: "Bob Jones",
      registered: 100,
      questions: [
        { questionId: 0, average: 5, responses: 80, registered: 100 },
        { questionId: 1, average: 4, responses: 80, registered: 100 },
      ],
    },
  ];
  return {
    questions: [
      { text: "The course was well organized", scale: true, options: [] },
      { text: "I learned a lot", scale: true, options: [] },
    ],
    byCourseNorm: new Map([[normalizeCourseCode("ECO 1104"), views]]),
  };
}

describe("feedback-data", () => {
  it("resolves views by normalized course code (spacing/case-insensitive)", () => {
    const index = makeIndex();
    expect(feedbackViewsForCourse(index, "ECO 1104")).toHaveLength(2);
    expect(feedbackViewsForCourse(index, "eco1104")).toHaveLength(2);
    expect(feedbackViewsForCourse(index, "MAT 1320")).toHaveLength(0);
  });

  it("joins professor section views by normalized name", () => {
    const index = makeIndex();
    // Alice taught only the first (term 2231) section.
    expect(feedbackViewsForProfessor(index, "Alice Smith")).toHaveLength(1);
    expect(feedbackViewsForProfessor(index, "  alice   smith  ")).toHaveLength(0); // case-sensitive value
    expect(feedbackViewsForProfessor(index, "Bob Jones")[0]?.termId).toBe(2241);
    expect(feedbackViewsForProfessor(index, "Nobody Here")).toHaveLength(0);
    expect(feedbackViewsForProfessor(index, "")).toHaveLength(0);
  });

  it("computes headline satisfaction, responses, rate and terms", () => {
    const views = feedbackViewsForCourse(makeIndex(), "ECO 1104");
    const headline = feedbackHeadline(views);
    // Response-weighted mean of (4,3 @50) + (5,4 @80) = (4*50+3*50+5*80+4*80)/260.
    expect(headline.satisfaction).toBeCloseTo((4 * 50 + 3 * 50 + 5 * 80 + 4 * 80) / 260, 5);
    expect(headline.totalResponses).toBe(260);
    // Respondents = max responses per section (50 + 80) over registered (200).
    expect(headline.responseRate).toBeCloseTo(130 / 200, 5);
    expect(headline.termsCovered).toBe(2);
  });

  it("builds an ascending sentiment series", () => {
    const views = feedbackViewsForCourse(makeIndex(), "ECO 1104");
    const series = feedbackSentimentSeries(views);
    expect(series).toHaveLength(2);
    expect(series[0]?.value).toBeCloseTo(3.5, 5); // (4+3)/2 term 2231
    expect(series[1]?.value).toBeCloseTo(4.5, 5); // (5+4)/2 term 2241
  });

  it("expresses the response-rate series as percentages", () => {
    const views = feedbackViewsForCourse(makeIndex(), "ECO 1104");
    const rate = feedbackRateSeries(views);
    expect(rate).toHaveLength(2);
    expect(rate[0]?.value).toBeCloseTo(50, 5); // 50/100
    expect(rate[1]?.value).toBeCloseTo(80, 5); // 80/100
  });

  it("builds per-question charts sorted by total responses", () => {
    const index = makeIndex();
    const views = feedbackViewsForCourse(index, "ECO 1104");
    const charts = feedbackQuestionCharts(views, index.questions);
    expect(charts).toHaveLength(2);
    // Both questions have 130 responses; each chart has 2 ascending term points.
    expect(charts[0]?.points).toHaveLength(2);
    expect(charts[0]?.responsesTotal).toBe(130);
    expect(charts.map((c) => c.text)).toEqual(
      expect.arrayContaining(["The course was well organized", "I learned a lot"]),
    );
  });
});

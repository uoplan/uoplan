/**
 * Representative grade distributions used to drive the native charts until the
 * live data layer (C2) is wired. Shapes mirror real uOttawa registrar spreads so
 * the histogram exercises every bucket. Replaced at runtime by decoded `.pb`
 * grade data once the native data client lands.
 */
export interface SampleCourseGrades {
  code: string;
  title: string;
  /** Raw letter-grade → student-count map (fed through normalizeGradeVizDistribution). */
  distribution: Record<string, number>;
}

export const SAMPLE_COURSE_GRADES: SampleCourseGrades[] = [
  {
    code: "ITI 1120",
    title: "Introduction to Computing I",
    distribution: {
      "A+": 96,
      A: 72,
      "A-": 64,
      "B+": 88,
      B: 110,
      "C+": 92,
      C: 78,
      "D+": 41,
      D: 33,
      F: 58,
      EIN: 6,
      ABS: 9,
      DR: 24,
    },
  },
  {
    code: "MAT 1320",
    title: "Calculus I",
    distribution: {
      "A+": 54,
      A: 61,
      "A-": 70,
      "B+": 95,
      B: 128,
      "C+": 104,
      C: 96,
      "D+": 58,
      D: 47,
      F: 83,
      EIN: 4,
      ABS: 12,
      DR: 39,
    },
  },
  {
    code: "CSI 2110",
    title: "Data Structures and Algorithms",
    distribution: {
      "A+": 118,
      A: 86,
      "A-": 74,
      "B+": 69,
      B: 62,
      "C+": 44,
      C: 31,
      "D+": 18,
      D: 12,
      F: 27,
      DR: 15,
    },
  },
  {
    code: "ADM 1100",
    title: "Introduction to Business Management",
    distribution: {
      "A+": 40,
      A: 88,
      "A-": 132,
      "B+": 164,
      B: 150,
      "C+": 96,
      C: 61,
      "D+": 24,
      D: 17,
      F: 19,
      DR: 11,
    },
  },
  {
    code: "BIO 1130",
    title: "Introduction to Organismal Biology",
    distribution: {
      "A+": 62,
      A: 70,
      "A-": 81,
      "B+": 110,
      B: 124,
      "C+": 88,
      C: 72,
      "D+": 39,
      D: 28,
      F: 44,
      ABS: 7,
      DR: 21,
    },
  },
  {
    code: "PSY 1101",
    title: "Introduction to Psychology: Foundations",
    distribution: {
      "A+": 84,
      A: 120,
      "A-": 156,
      "B+": 188,
      B: 174,
      "C+": 102,
      C: 70,
      "D+": 31,
      D: 22,
      F: 26,
      DR: 18,
    },
  },
  {
    code: "ECO 1104",
    title: "Introduction to Microeconomics",
    distribution: {
      "A+": 36,
      A: 58,
      "A-": 74,
      "B+": 96,
      B: 118,
      "C+": 124,
      C: 110,
      "D+": 67,
      D: 53,
      F: 71,
      EIN: 5,
      DR: 33,
    },
  },
];

/** Course code → its sample grade distribution (for inline explore histograms). */
export const SAMPLE_GRADES_BY_CODE: Record<string, Record<string, number>> = Object.fromEntries(
  SAMPLE_COURSE_GRADES.map((course) => [course.code, course.distribution]),
);

export interface TermGpaPoint {
  /** Short term label, e.g. "F23" (Fall 2023). */
  term: string;
  /** Average grade on uOttawa's 10-point scale. */
  gpa: number;
}

/**
 * Sample per-term average-grade series (10-point scale) used by the native
 * trends LineChart until the live data layer (C2) lands. Six terms per course,
 * shaped to look like real registrar drift.
 */
export const SAMPLE_TERM_GPA: Record<string, TermGpaPoint[]> = {
  "ITI 1120": [
    { term: "F21", gpa: 6.4 },
    { term: "W22", gpa: 6.1 },
    { term: "F22", gpa: 6.8 },
    { term: "W23", gpa: 6.5 },
    { term: "F23", gpa: 7.0 },
    { term: "W24", gpa: 6.7 },
  ],
  "MAT 1320": [
    { term: "F21", gpa: 5.6 },
    { term: "W22", gpa: 5.2 },
    { term: "F22", gpa: 5.9 },
    { term: "W23", gpa: 5.4 },
    { term: "F23", gpa: 6.1 },
    { term: "W24", gpa: 5.8 },
  ],
  "CSI 2110": [
    { term: "F21", gpa: 7.2 },
    { term: "W22", gpa: 7.5 },
    { term: "F22", gpa: 7.1 },
    { term: "W23", gpa: 7.6 },
    { term: "F23", gpa: 7.4 },
    { term: "W24", gpa: 7.7 },
  ],
  "ADM 1100": [
    { term: "F21", gpa: 7.0 },
    { term: "W22", gpa: 7.3 },
    { term: "F22", gpa: 6.9 },
    { term: "W23", gpa: 7.2 },
    { term: "F23", gpa: 7.1 },
    { term: "W24", gpa: 7.4 },
  ],
  "BIO 1130": [
    { term: "F21", gpa: 6.5 },
    { term: "W22", gpa: 6.2 },
    { term: "F22", gpa: 6.7 },
    { term: "W23", gpa: 6.4 },
    { term: "F23", gpa: 6.9 },
    { term: "W24", gpa: 6.6 },
  ],
  "PSY 1101": [
    { term: "F21", gpa: 7.1 },
    { term: "W22", gpa: 7.4 },
    { term: "F22", gpa: 7.0 },
    { term: "W23", gpa: 7.5 },
    { term: "F23", gpa: 7.3 },
    { term: "W24", gpa: 7.6 },
  ],
  "ECO 1104": [
    { term: "F21", gpa: 5.9 },
    { term: "W22", gpa: 5.6 },
    { term: "F22", gpa: 6.2 },
    { term: "W23", gpa: 5.8 },
    { term: "F23", gpa: 6.4 },
    { term: "W24", gpa: 6.0 },
  ],
};

import { describe, it, expect } from 'vitest';
import {
  aggregateCourseDistribution,
  courseGpa,
  distributionGpa,
  GRADE_POINTS,
} from '../gradeDistribution';
import type { ComponentSection, CourseSchedule } from 'schemas';

const minimalSection = (distribution: Record<string, number>): ComponentSection => ({
  section: 'X',
  sectionCode: 'X',
  component: 'LEC',
  session: null,
  times: [{ day: 'Mo', startMinutes: 600, endMinutes: 660, virtual: false }],
  instructors: [],
  meetingDates: null,
  status: null,
  distribution,
});

describe('gradeDistribution', () => {
  it('distributionGpa computes weighted mean over counted grades', () => {
    const dist = { A: 10, B: 10, F: 0, P: 5 };
    const gpa = distributionGpa(dist);
    expect(gpa).toBeCloseTo((10 * GRADE_POINTS.A + 10 * GRADE_POINTS.B) / 20, 5);
  });

  it('distributionGpa returns null when only non-counted grades', () => {
    expect(distributionGpa({ P: 1, S: 2 })).toBeNull();
  });

  it('aggregateCourseDistribution sums section distributions', () => {
    const schedule: CourseSchedule = {
      subject: 'ADM',
      catalogNumber: '1100',
      courseCode: 'ADM 1100',
      title: null,
      timeZone: 'America/Toronto',
      components: {
        LEC: [minimalSection({ A: 2, B: 1 }), minimalSection({ B: 1, C: 3 })],
      },
    };

    const agg = aggregateCourseDistribution(schedule);
    expect(agg.A).toBe(2);
    expect(agg.B).toBe(2);
    expect(agg.C).toBe(3);
    expect(courseGpa(schedule)).not.toBeNull();
  });
});

import { vi } from "vitest";

import type { GenerationOptionsFieldsProps } from "./GenerationOptionsFields";

export function makeGenerationOptionsProps(
  overrides: Partial<GenerationOptionsFieldsProps> = {},
): GenerationOptionsFieldsProps {
  return {
    countValue: 5,
    onCountChange: vi.fn(),
    countMin: 1,
    countMax: 10,
    totalFirstYearCredits: 0,
    warnFirstYearLimit: false,
    limitFirstYearCredits: false,
    onLimitFirstYearCreditsChange: vi.fn(),
    compressedSchedule: false,
    onCompressedScheduleChange: vi.fn(),
    preferEasierCourses: false,
    onPreferEasierCoursesChange: vi.fn(),
    preferHigherSentiment: false,
    onPreferHigherSentimentChange: vi.fn(),
    minStartMinutes: 0,
    onMinStartMinutesChange: vi.fn(),
    maxEndMinutes: 1440,
    onMaxEndMinutesChange: vi.fn(),
    avoidedDays: [],
    onAvoidedDaysChange: vi.fn(),
    minProfessorRating: null,
    onMinProfessorRatingChange: vi.fn(),
    levelBuckets: [],
    languageBuckets: [],
    electiveLevelBuckets: [],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    onChangeLevelBuckets: vi.fn(),
    onChangeLanguageBuckets: vi.fn(),
    onChangeElectiveLevelBuckets: vi.fn(),
    onIncludeClosedComponentsChange: vi.fn(),
    onVirtualSectionsOnlyChange: vi.fn(),
    excludeSubjects: { data: [], value: [], onChange: vi.fn() },
    excludeCourses: { data: [], value: [], onChange: vi.fn() },
    frenchImmersionStream: false,
    onFrenchImmersionStreamChange: vi.fn(),
    advancedOptions: { collapseId: "test-advanced-options-collapse" },
    ...overrides,
  };
}

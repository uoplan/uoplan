import { vi } from "vitest";

import { defaultOptimizationPriorities } from "@uoplan/core";

import type { GenerationOptionsFieldsProps } from "./GenerationOptionsFields";

export function makeGenerationOptionsProps(
  overrides: Partial<GenerationOptionsFieldsProps> = {},
): GenerationOptionsFieldsProps {
  return {
    coursesThisSemesterValue: 5,
    onCoursesThisSemesterChange: vi.fn(),
    coursesThisSemesterMin: 0,
    coursesThisSemesterMax: 10,
    countValue: 5,
    onCountChange: vi.fn(),
    countMin: 1,
    countMax: 10,
    totalFirstYearCredits: 0,
    warnFirstYearLimit: false,
    limitFirstYearCredits: false,
    onLimitFirstYearCreditsChange: vi.fn(),
    optimizationPriorities: defaultOptimizationPriorities(),
    onReorderPriorities: vi.fn(),
    onSetPriorities: vi.fn(),
    onTogglePriority: vi.fn(),
    onGoodBreaksParamsChange: vi.fn(),
    minStartMinutes: 0,
    onMinStartMinutesChange: vi.fn(),
    maxEndMinutes: 1440,
    onMaxEndMinutesChange: vi.fn(),
    avoidedDays: [],
    onAvoidedDaysChange: vi.fn(),
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

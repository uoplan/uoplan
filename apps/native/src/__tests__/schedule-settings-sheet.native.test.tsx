import { cleanup, render } from "@testing-library/react-native";

const mockSetOptions = jest.fn();
const mockReset = jest.fn();

jest.mock("@/data/basket-provider", () => ({
  useBasket: () => ({ codes: [], count: 0 }),
}));

jest.mock("@/data/completed-courses-provider", () => ({
  useCompletedCourses: () => ({ codes: [] }),
}));

jest.mock("@/data/data-provider", () => ({
  useAppData: () => ({
    bundle: {
      catalogue: { courses: [], programs: [] },
      disciplines: [],
      faculties: [],
      terms: [{ termId: "202509", name: "Fall 2025" }],
    },
    schedulesByTerm: new Map([["202509", { termId: "202509", schedules: [] }]]),
  }),
}));

jest.mock("@/data/schedule-options-provider", () => ({
  useScheduleOptions: () => ({
    // oxlint-disable-next-line typescript/no-require-imports
    options: require("@/lib/schedule-options").DEFAULT_SCHEDULE_OPTIONS,
    setOptions: mockSetOptions,
    reset: mockReset,
  }),
}));

jest.mock("@/lib/adaptive-layout", () => ({
  useAdaptiveLayout: () => ({ width: 390, height: 844, formSheet: false }),
}));

jest.mock("@/lib/analytics", () => ({
  getAnalytics: () => ({ capture: jest.fn() }),
}));

// Prevent real push-permission probes (expo-notifications) during render.
jest.mock("@/lib/push", () => ({
  getPushPermission: () => Promise.resolve("undetermined"),
  enableReminders: jest.fn(),
}));

// Lazily import the component under test after mocks are in place.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ScheduleSettingsSheet } from "@/components/schedule-settings-sheet";

const baseProps = {
  opened: true,
  onClose: jest.fn(),
  basketCount: 0,
  onPersonalize: jest.fn(),
  onAddToCalendar: jest.fn(),
  onExport: jest.fn(),
  exporting: false,
} as const;

afterEach(cleanup);
beforeEach(() => {
  mockSetOptions.mockReset();
  mockReset.mockReset();
});

describe("ScheduleSettingsSheet", () => {
  describe("hasProgram={false}", () => {
    it("hides the Courses-this-semester stepper", async () => {
      const { queryByText } = await render(
        <ScheduleSettingsSheet {...baseProps} hasProgram={false} />,
      );
      expect(queryByText("Courses this semester")).toBeNull();
    });

    it("keeps the additional-elective stepper visible", async () => {
      const { getByText } = await render(
        <ScheduleSettingsSheet {...baseProps} hasProgram={false} />,
      );
      expect(getByText("Electives this semester (additional)")).toBeTruthy();
    });

    it("does not call setOptions as a side-effect of rendering", async () => {
      await render(<ScheduleSettingsSheet {...baseProps} hasProgram={false} />);
      expect(mockSetOptions).not.toHaveBeenCalled();
    });
  });

  describe("hasProgram={true}", () => {
    it("shows the Courses-this-semester stepper", async () => {
      const { getByText } = await render(
        <ScheduleSettingsSheet {...baseProps} hasProgram={true} />,
      );
      expect(getByText("Courses this semester")).toBeTruthy();
    });

    it("keeps the additional-elective stepper visible", async () => {
      const { getByText } = await render(
        <ScheduleSettingsSheet {...baseProps} hasProgram={true} />,
      );
      expect(getByText("Electives this semester (additional)")).toBeTruthy();
    });
  });
});

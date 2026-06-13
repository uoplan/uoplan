import { render } from "@testing-library/react-native";

import { WeekCalendar } from "@/components/week-calendar";
import { SAMPLE_SCHEDULE } from "@/data/sample-schedule";

// The native week calendar is a read-only RN leaf that reuses the shared
// `@uoplan/calendar` layout math (assignLanes / WEEKDAY_CODES / DAY_LABELS) and
// positions events as absolutely-placed Views — no SVG, no native rebuild.
describe("WeekCalendar (native)", () => {
  it("renders weekday headers, hour labels and course events", async () => {
    const { getByText, getAllByText } = await render(<WeekCalendar events={SAMPLE_SCHEDULE} />);

    // Mon–Fri day headers.
    expect(getByText("Mon")).toBeTruthy();
    expect(getByText("Fri")).toBeTruthy();

    // An hour label from the time axis.
    expect(getByText("08:00")).toBeTruthy();

    // Course codes from the sample week (ITI runs Mon + Wed + Fri; MAT Tue + Thu).
    expect(getAllByText("ITI 1120").length).toBeGreaterThanOrEqual(2);
    expect(getAllByText("MAT 1320").length).toBeGreaterThanOrEqual(2);
  });

  it("renders nothing event-related when there are no events", async () => {
    const { queryByText, getByText } = await render(<WeekCalendar events={[]} />);
    // Grid chrome still renders...
    expect(getByText("Mon")).toBeTruthy();
    // ...but no sample courses.
    expect(queryByText("ITI 1120")).toBeNull();
  });
});

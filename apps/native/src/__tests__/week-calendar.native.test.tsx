import { fireEvent, render } from "@testing-library/react-native";

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

    // The fixed time axis always starts at 08:30.
    expect(getByText("08:30")).toBeTruthy();

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

  it("renders blocked-time regions without hiding event taps", async () => {
    const onEventPress = jest.fn();
    const { getByLabelText, getByText, getAllByText } = await render(
      <WeekCalendar
        events={SAMPLE_SCHEDULE}
        blockedTimes={[{ day: "Mo", startMinutes: 9 * 60, endMinutes: 10 * 60 + 30 }]}
        onBlockedTimesChange={jest.fn()}
        onEventPress={onEventPress}
      />,
    );

    expect(getByLabelText("Blocked time")).toBeTruthy();
    expect(getByText("9:00–10:30")).toBeTruthy();

    fireEvent.press(getAllByText("ITI 1120")[0]!);
    expect(onEventPress).toHaveBeenCalledTimes(1);
  });

  it("invokes onEventPress with the event and its colour when an event is tapped", async () => {
    const onEventPress = jest.fn();
    const { getAllByText } = await render(
      <WeekCalendar events={SAMPLE_SCHEDULE} onEventPress={onEventPress} />,
    );

    fireEvent.press(getAllByText("ITI 1120")[0]!);

    expect(onEventPress).toHaveBeenCalledTimes(1);
    const [event, color] = onEventPress.mock.calls[0]!;
    expect(event.courseCode).toBe("ITI 1120");
    expect(typeof color).toBe("string");
  });
});

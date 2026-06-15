import { fireEvent, render } from "@testing-library/react-native";

import type { CalendarEvent } from "@uoplan/calendar/types";

import { CalendarEventDrawer } from "@/components/calendar-event-drawer";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    courseCode: "ITI 1120",
    enrollmentIndex: 0,
    day: "Mo",
    startMinutes: 600,
    endMinutes: 690,
    componentSection: "LEC - A00",
    virtual: false,
    professor: "Jane Doe" as CalendarEvent["professor"],
    professorRatingValue: 4.1,
    professorRatingDetails: [
      { name: "Jane Doe" as CalendarEvent["professor"], rating: 4.1, numRatings: 12 },
    ],
    courseSentiment: 4.2,
    professorSentiment: 4,
    ...overrides,
  };
}

describe("CalendarEventDrawer (native)", () => {
  it("renders nothing when no event is selected", async () => {
    const { toJSON } = await render(
      <CalendarEventDrawer event={null} onClose={() => {}} onViewCourse={() => {}} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows the section, time, satisfaction, RMP and instructor details", async () => {
    const { getByText } = await render(
      <CalendarEventDrawer
        event={makeEvent()}
        courseTitle="Introduction to Computing II"
        onClose={() => {}}
        onViewCourse={() => {}}
      />,
    );

    expect(getByText("ITI 1120")).toBeTruthy();
    expect(getByText("Introduction to Computing II")).toBeTruthy();
    expect(getByText("LEC - A00")).toBeTruthy();
    // Day + time range.
    expect(getByText("Mon · 10:00–11:30")).toBeTruthy();
    // Course + professor satisfaction (1-5).
    expect(getByText("4.2 / 5")).toBeTruthy();
    expect(getByText("4.0 / 5")).toBeTruthy();
    // RMP rating with count.
    expect(getByText("4.1 (12)")).toBeTruthy();
    expect(getByText("Jane Doe")).toBeTruthy();
  });

  it("invokes onViewCourse (and closes) when the course link is tapped", async () => {
    const onViewCourse = jest.fn();
    const onClose = jest.fn();
    const { getByText } = await render(
      <CalendarEventDrawer event={makeEvent()} onClose={onClose} onViewCourse={onViewCourse} />,
    );

    fireEvent.press(getByText("View course →"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onViewCourse).toHaveBeenCalledWith("ITI 1120");
  });
});

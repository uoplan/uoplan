import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { NotificationToggle } from "@/components/notification-toggle";

// Push handlers are injected, so this render test needs no native-module mocks
// (mocking expo modules in a render test breaks the RNTL React instance).
it("requests permission and reflects the granted state when toggled on", async () => {
  const getPermission = jest.fn().mockResolvedValue("undetermined" as const);
  const enable = jest
    .fn()
    .mockResolvedValue({ permission: "granted" as const, notificationId: "n1" });

  const { getByText, getByTestId } = await render(
    <NotificationToggle getPermission={getPermission} enable={enable} />,
  );
  await waitFor(() => expect(getPermission).toHaveBeenCalled());

  expect(getByText("Get a reminder when your timetable is ready.")).toBeTruthy();

  fireEvent(getByTestId("schedule-reminders-switch"), "valueChange", true);

  await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(getByText("Reminders on — we'll nudge you when a schedule is ready.")).toBeTruthy(),
  );
});

it("does not enable when permission is denied", async () => {
  const getPermission = jest.fn().mockResolvedValue("denied" as const);
  const enable = jest.fn();

  const { getByText } = await render(
    <NotificationToggle getPermission={getPermission} enable={enable} />,
  );
  await waitFor(() => expect(getByText("Notifications are blocked in Settings.")).toBeTruthy());
  expect(enable).not.toHaveBeenCalled();
});

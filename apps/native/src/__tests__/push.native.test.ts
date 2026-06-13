import {
  enableReminders,
  getPushPermission,
  requestPushPermission,
  scheduleScheduleReminder,
} from "@/lib/push";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));

import * as Notifications from "expo-notifications";

const mockGet = Notifications.getPermissionsAsync as jest.Mock;
const mockRequest = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSchedule.mockResolvedValue("notif-1");
});

describe("push permission helpers", () => {
  it("normalizes granted/denied/undetermined", async () => {
    mockGet.mockResolvedValueOnce({ status: "granted" });
    expect(await getPushPermission()).toBe("granted");
    mockGet.mockResolvedValueOnce({ status: "denied" });
    expect(await getPushPermission()).toBe("denied");
    mockGet.mockResolvedValueOnce({ status: "something-else" });
    expect(await getPushPermission()).toBe("undetermined");
  });

  it("requests permission and returns the result", async () => {
    mockRequest.mockResolvedValueOnce({ status: "granted" });
    expect(await requestPushPermission()).toBe("granted");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("schedules a time-interval reminder", async () => {
    const id = await scheduleScheduleReminder(10);
    expect(id).toBe("notif-1");
    const arg = mockSchedule.mock.calls[0][0];
    expect(arg.trigger.type).toBe("timeInterval");
    expect(arg.trigger.seconds).toBe(10);
    expect(arg.content.title).toBe("uoplan");
  });
});

describe("enableReminders", () => {
  it("prompts when undetermined, then schedules on grant", async () => {
    mockGet.mockResolvedValueOnce({ status: "undetermined" });
    mockRequest.mockResolvedValueOnce({ status: "granted" });
    const result = await enableReminders();
    expect(result.permission).toBe("granted");
    expect(result.notificationId).toBe("notif-1");
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it("does not prompt again when already granted", async () => {
    mockGet.mockResolvedValueOnce({ status: "granted" });
    const result = await enableReminders();
    expect(result.permission).toBe("granted");
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it("returns denied without scheduling when the user declines", async () => {
    mockGet.mockResolvedValueOnce({ status: "undetermined" });
    mockRequest.mockResolvedValueOnce({ status: "denied" });
    const result = await enableReminders();
    expect(result.permission).toBe("denied");
    expect(result.notificationId).toBeUndefined();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

import { Share } from "react-native";

import type { CalendarEvent } from "@uoplan/calendar/types";

// Minimal expo-file-system mock exposing the File/Paths API the share helper
// uses (write + uri), backed by a Map so no native module is needed.
jest.mock("expo-file-system", () => {
  const store = new Map<string, string>();
  class Paths {
    static get cache() {
      return { path: "cache" };
    }
  }
  class File {
    key: string;
    constructor(dir: { path: string }, name: string) {
      this.key = `${dir.path}/${name}`;
    }
    get exists() {
      return store.has(this.key);
    }
    get uri() {
      return `file:///${this.key}`;
    }
    write(content: string) {
      store.set(this.key, content);
    }
    delete() {
      store.delete(this.key);
    }
  }
  return { File, Paths, Directory: class {} };
});

import { exportScheduleIcs } from "@/lib/share-ics";

const events: CalendarEvent[] = [
  {
    id: "iti-mon",
    courseCode: "ITI 1120",
    day: "Mo",
    startMinutes: 600,
    endMinutes: 690,
    componentSection: "LEC A00",
    professor: "Lapalme",
    enrollmentIndex: 0,
    virtual: false,
  } as CalendarEvent,
];

describe("exportScheduleIcs", () => {
  it("writes a cache file and opens the share sheet with its URL", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: Share.sharedAction } as Awaited<ReturnType<typeof Share.share>>);

    await exportScheduleIcs({ events, startDate: "2025-09-03", endDate: "2025-12-05" });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const arg = shareSpy.mock.calls[0][0] as { url?: string };
    expect(arg.url).toContain("uoplan-schedule.ics");
    shareSpy.mockRestore();
  });
});

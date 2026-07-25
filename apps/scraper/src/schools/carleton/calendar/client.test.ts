import { describe, expect, it, vi } from "vitest";

import {
  buildCalendarPath,
  CarletonCalendarClient,
  parseArchiveYears,
  parseSubjectIndex,
} from "./client.ts";

describe("Carleton calendar client helpers", () => {
  it("builds current and archive CourseLeaf paths", () => {
    expect(buildCalendarPath("/undergrad/courses/COMP/")).toBe(
      "https://calendar.carleton.ca/undergrad/courses/COMP/",
    );
    expect(buildCalendarPath("/undergrad/courses/COMP/", "2014-2015")).toBe(
      "https://calendar.carleton.ca/calendars/2014-2015/undergrad/courses/COMP/",
    );
  });

  it("enumerates uppercase subject codes from the index", () => {
    const html =
      '<a href="/undergrad/courses/COMP/">COMP</a><a href="/undergrad/courses/MATH/">MATH</a>';
    expect(parseSubjectIndex(html)).toEqual(["COMP", "MATH"]);
  });

  it("parses archive years from the archive page", () => {
    const html =
      '<a href="/calendars/2022-2023/">2022-2023</a><a href="https://calendar.carleton.ca/calendars/2014-2015/undergrad/">2014-2015</a>';
    expect(parseArchiveYears(html)).toEqual(["2022-2023", "2014-2015"]);
  });

  it("serializes requests through the configured fetch implementation", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
      return new Response("ok");
    });
    const client = new CarletonCalendarClient({ delayMs: 0, fetchImpl });

    await Promise.all([
      client.fetchSubjectCourses("comp"),
      client.fetchProgramPage("computerscience"),
    ]);

    expect(calls).toEqual([
      "https://calendar.carleton.ca/undergrad/courses/COMP/",
      "https://calendar.carleton.ca/undergrad/undergradprograms/computerscience/",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

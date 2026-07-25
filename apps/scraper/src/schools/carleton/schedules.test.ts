import { describe, expect, it } from "vitest";

import { scrapeCarletonScheduleTerm } from "./schedules.ts";

describe("scrapeCarletonScheduleTerm", () => {
  it("routes each requested subject through Banner search and writes shared schedule data", async () => {
    const searches: string[] = [];
    const client = {
      async searchCourses(request: { subject: string }) {
        searches.push(request.subject);
        return `
          <table>
            <tr bgcolor="#fff"><td><input type="checkbox"/></td><td>Open</td><td><a href="detail">31054</a></td><td>${request.subject} 1005</td><td>A</td><td>Intro</td><td>0.5</td><td>Lecture</td><td></td><td></td><td>Robert Collier</td></tr>
            <tr bgcolor="#fff"><td></td><td>Meeting Date: Sep 09, 2026 to Dec 11, 2026 Days: Mon Wed Time: 08:35 - 09:55</td></tr>
          </table>
        `;
      },
    };

    const data = await scrapeCarletonScheduleTerm({
      termId: "202630",
      sessionId: "26061541",
      subjects: ["COMP", "MATH"],
      client,
    });

    expect(searches).toEqual(["COMP", "MATH"]);
    expect(data).toMatchObject({
      termId: "202630",
      totalCourses: 2,
      totalWithSchedules: 2,
    });
    expect(data.schedules.map((schedule) => schedule.courseCode)).toEqual([
      "COMP 1005",
      "MATH 1005",
    ]);
  });
});

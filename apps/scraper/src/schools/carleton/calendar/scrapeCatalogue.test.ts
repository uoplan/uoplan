import { describe, expect, it } from "vitest";

import { scrapeCarletonCatalogue } from "./scrapeCatalogue.ts";

describe("scrapeCarletonCatalogue", () => {
  it("continues after per-item failures and reports misses", async () => {
    const client = {
      async fetchSubjectIndex() {
        return '<a href="/undergrad/courses/COMP/">COMP</a><a href="/undergrad/courses/FAIL/">FAIL</a>';
      },
      async fetchSubjectCourses(subject: string) {
        if (subject === "FAIL") throw new Error("boom");
        return '<div class="courseblock"><strong><span class="courseblocktitle"><span class="courseblockcode">COMP&#160;1005</span> [0.5 credit]<br/>Intro</span></strong><br/>Description.<br/><div class="coursedescadditional">Lectures three hours a week.<br/></div><br/></div>';
      },
      async fetchUndergradProgramsIndex() {
        return '<a href="/undergrad/undergradprograms/computerscience/">Computer Science</a>';
      },
      async fetchProgramPage() {
        return '<h3 id="Program_A">Program A (1.0 credits)</h3><table class="sc_courselist"><tr><td><span class="courselistcomment"><strong>1. 0.5 credit in free electives</strong></span></td><td class="hourscol">0.5</td></tr><tr class="listsum"><td>Total Credits</td><td>0.5</td></tr></table>';
      },
    };

    const result = await scrapeCarletonCatalogue({ client, delayMs: 0, log: false });

    expect(result.catalogue.courses).toHaveLength(1);
    expect(result.catalogue.programs).toHaveLength(1);
    expect(result.report.misses).toEqual([
      {
        kind: "subject",
        id: "FAIL",
        url: "https://calendar.carleton.ca/undergrad/courses/FAIL/",
        reason: "boom",
      },
    ]);
    expect(result.report.requirementParseRate).toBe(1);
  });
});

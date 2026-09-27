import { describe, expect, it, vi } from "vitest";
import { scrapeCourses } from "./courses.ts";

vi.mock("../shared/http.ts", () => ({
  fetchHtml: vi.fn().mockResolvedValue(`
    <div class="courseblock">
      <p class="courseblocktitle">ADM 3349 Auditing Theory (3 units)</p>
      <p class="courseblockdesc">Auditing theory.</p>
      <p class="courseblockextra">Course Component: Lecture</p>
      <p class="courseblockextra highlight">Prerequisite or Corequisite: ADM&nbsp;3340.</p>
    </div>
  `),
}));

describe("catalogue course scraping", () => {
  it("separates ADM 3349's component from its combined prerequisite label", async () => {
    const courses = await scrapeCourses("https://example.test/adm/");
    expect(courses).toEqual([
      expect.objectContaining({
        code: "ADM 3349",
        component: "Lecture",
        prereqText: "ADM 3340",
        prerequisites: { type: "course", code: "ADM 3340", text: "ADM 3340" },
      }),
    ]);
  });
});

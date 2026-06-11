import { describe, it, expect } from "vitest";
import {
  computeRemainingRequirements,
  computeRequirementTreeWithStatus,
  collectCompletedRequirements,
} from "../requirements";
import { buildDataCache } from "../dataCache";
import type { Catalogue, Program } from "../dataTypes";
import type { SchedulesData } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

const minimalCatalogue: Catalogue = {
  courses: [
    {
      code: normalizeCourseCode("ESL 2100"),
      title: normalizeCourseCode("ESL 2100"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 2121"),
      title: normalizeCourseCode("ESL 2121"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 2122"),
      title: normalizeCourseCode("ESL 2122"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 2181"),
      title: normalizeCourseCode("ESL 2181"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 2332"),
      title: normalizeCourseCode("ESL 2332"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 3181"),
      title: normalizeCourseCode("ESL 3181"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ESL 3351"),
      title: normalizeCourseCode("ESL 3351"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ENG 1100"),
      title: "Literature",
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("ENG 2100"),
      title: "Writing",
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("FLS 2581"),
      title: normalizeCourseCode("FLS 2581"),
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("FLS 3581"),
      title: normalizeCourseCode("FLS 3581"),
      credits: 3,
      description: "",
      component: "LEC",
    },
  ],
  programs: [],
};

const emptySchedules: SchedulesData = { termId: "2261", schedules: [] };

const eslMinorProgram: Program = {
  title: "Advanced Minor English as a Second Language (ESL)",
  url: "https://example.com",
  requirements: [
    {
      type: "and",
      title: "Compulsory courses",
      options: [
        { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
        { type: "course", code: normalizeCourseCode("ESL 2121"), credits: 3 },
        { type: "course", code: normalizeCourseCode("ESL 2122"), credits: 3 },
      ],
    },
    {
      type: "and",
      title: "Optional courses",
      options: [
        {
          type: "group",
          title: "9 course units from:",
          credits: 9,
          options: [
            { type: "course", code: normalizeCourseCode("ESL 2181") },
            { type: "course", code: normalizeCourseCode("ESL 2332") },
          ],
        },
        {
          type: "group",
          title: "9 course units from:",
          credits: 9,
          options: [
            { type: "course", code: normalizeCourseCode("ESL 3181") },
            { type: "course", code: normalizeCourseCode("ESL 3351") },
          ],
        },
        {
          type: "discipline_elective",
          title: "3 optional course units in English (ENG)",
          credits: 3,
          disciplineLevels: [{ discipline: "ENG" }],
        },
      ],
    },
  ],
};

function testProgram(requirements: Program["requirements"]): Program {
  return { title: "Test", url: "", requirements };
}

function eslOrProgram(title?: string): Program {
  const requirement = {
    type: "or_group" as const,
    options: [
      { type: "course" as const, code: normalizeCourseCode("ESL 2100") },
      { type: "course" as const, code: normalizeCourseCode("ESL 2121") },
    ],
  };
  return testProgram([title === undefined ? requirement : { ...requirement, title }]);
}

function eslThreeCourseGroupProgram(): Program {
  return testProgram([
    {
      type: "group",
      credits: 9,
      options: [
        { type: "course", code: normalizeCourseCode("ESL 2181") },
        { type: "course", code: normalizeCourseCode("ESL 2332") },
        { type: "course", code: normalizeCourseCode("ESL 3181") },
      ],
    },
  ]);
}

function expectCandidateCourses(
  remaining: ReturnType<typeof computeRemainingRequirements>,
  codes: string[],
) {
  for (const code of codes) {
    expect(remaining[0].candidateCourses).toContain(normalizeCourseCode(code));
  }
}

describe("computeRemainingRequirements", () => {
  const cache = buildDataCache(minimalCatalogue, emptySchedules);

  describe("course", () => {
    it("returns 1 remaining slot when not completed", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [{ type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 }],
      };
      const remaining = computeRemainingRequirements(program, [], cache);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].candidateCourses).toEqual([normalizeCourseCode("ESL 2100")]);
      expect(remaining[0].type).toBe("course");
    });

    it("returns 0 when completed", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [{ type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 }],
      };
      const remaining = computeRemainingRequirements(
        program,
        [normalizeCourseCode("ESL 2100")],
        cache,
      );
      expect(remaining).toHaveLength(0);
    });
  });

  describe("or_course", () => {
    it("returns slot with candidates when none done", () => {
      const remaining = computeRemainingRequirements(eslOrProgram("One of"), [], cache);
      expect(remaining).toHaveLength(1);
      expectCandidateCourses(remaining, ["ESL 2100", "ESL 2121"]);
    });

    it("still returns one remaining slot when one option completed (user assigns explicitly)", () => {
      const remaining = computeRemainingRequirements(
        eslOrProgram(),
        [normalizeCourseCode("ESL 2100")],
        cache,
      );
      expect(remaining).toHaveLength(1);
      expectCandidateCourses(remaining, ["ESL 2100", "ESL 2121"]);
    });
  });

  describe("and", () => {
    it("returns multiple slots when none done", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [
          {
            type: "and",
            options: [
              { type: "course", code: normalizeCourseCode("ESL 2100") },
              { type: "course", code: normalizeCourseCode("ESL 2121") },
              { type: "course", code: normalizeCourseCode("ESL 2122") },
            ],
          },
        ],
      };
      const remaining = computeRemainingRequirements(program, [], cache);
      expect(remaining).toHaveLength(3);
    });

    it("reduces as each completed", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [
          {
            type: "and",
            options: [
              { type: "course", code: normalizeCourseCode("ESL 2100") },
              { type: "course", code: normalizeCourseCode("ESL 2121") },
            ],
          },
        ],
      };
      expect(computeRemainingRequirements(program, [], cache)).toHaveLength(2);
      expect(
        computeRemainingRequirements(program, [normalizeCourseCode("ESL 2100")], cache),
      ).toHaveLength(1);
      expect(
        computeRemainingRequirements(
          program,
          [normalizeCourseCode("ESL 2100"), normalizeCourseCode("ESL 2121")],
          cache,
        ),
      ).toHaveLength(0);
    });
  });

  describe("group", () => {
    it("returns slot with N credits needed and candidate list", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [
          {
            type: "group",
            title: "9 course units from:",
            credits: 9,
            options: [
              { type: "course", code: normalizeCourseCode("ESL 2181") },
              { type: "course", code: normalizeCourseCode("ESL 2332") },
            ],
          },
        ],
      };
      const remaining = computeRemainingRequirements(program, [], cache);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].creditsNeeded).toBe(9);
      expect(remaining[0].candidateCourses).toContain(normalizeCourseCode("ESL 2181"));
      expect(remaining[0].candidateCourses).toContain(normalizeCourseCode("ESL 2332"));
    });

    it("still returns one slot with full credits needed when courses completed (user assigns explicitly)", () => {
      const remaining = computeRemainingRequirements(
        eslThreeCourseGroupProgram(),
        [
          normalizeCourseCode("ESL 2181"),
          normalizeCourseCode("ESL 2332"),
          normalizeCourseCode("ESL 3181"),
        ],
        cache,
      );
      expect(remaining).toHaveLength(1);
      expect(remaining[0].creditsNeeded).toBe(9);
      expect(remaining[0].satisfiedBy).toEqual([]);
    });

    it("shows full credits needed when partially completed (user assigns explicitly)", () => {
      const remaining = computeRemainingRequirements(
        eslThreeCourseGroupProgram(),
        [normalizeCourseCode("ESL 2181")],
        cache,
      );
      expect(remaining).toHaveLength(1);
      expect(remaining[0].creditsNeeded).toBe(9);
    });
  });

  describe("section", () => {
    it("never produces remaining slots", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [
          { type: "section", title: "Header only" },
          { type: "course", code: normalizeCourseCode("ESL 2100") },
        ],
      };
      const remaining = computeRemainingRequirements(program, [], cache);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].type).toBe("course");
    });
  });

  describe("discipline_elective", () => {
    it("returns slot with ENG-prefixed courses from catalogue", () => {
      const program: Program = {
        title: "Test",
        url: "",
        requirements: [
          {
            type: "discipline_elective",
            title: "3 units in ENG",
            credits: 3,
            disciplineLevels: [{ discipline: "ENG" }],
          },
        ],
      };
      const remaining = computeRemainingRequirements(program, [], cache);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].candidateCourses).toContain(normalizeCourseCode("ENG 1100"));
      expect(remaining[0].candidateCourses).toContain(normalizeCourseCode("ENG 2100"));
    });
  });

  describe("integration - ESL minor", () => {
    it("returns all requirements when nothing completed", () => {
      const remaining = computeRemainingRequirements(eslMinorProgram, [], cache);
      expect(remaining.length).toBeGreaterThanOrEqual(5);
      const compulsory = remaining.filter((r) =>
        r.candidateCourses.includes(normalizeCourseCode("ESL 2100")),
      );
      expect(compulsory.length).toBeGreaterThanOrEqual(1);
    });

    it("reduces compulsory when ESL 2100, 2121, 2122 completed", () => {
      const completed = [
        normalizeCourseCode("ESL 2100"),
        normalizeCourseCode("ESL 2121"),
        normalizeCourseCode("ESL 2122"),
      ];
      const remaining = computeRemainingRequirements(eslMinorProgram, completed, cache);
      const compulsorySlots = remaining.filter((r) =>
        [
          normalizeCourseCode("ESL 2100"),
          normalizeCourseCode("ESL 2121"),
          normalizeCourseCode("ESL 2122"),
        ].some((c) => r.candidateCourses.includes(c)),
      );
      expect(compulsorySlots).toHaveLength(0);
    });

    it("shows remaining optional when compulsory done", () => {
      const completed = [
        normalizeCourseCode("ESL 2100"),
        normalizeCourseCode("ESL 2121"),
        normalizeCourseCode("ESL 2122"),
      ];
      const remaining = computeRemainingRequirements(eslMinorProgram, completed, cache);
      const groupSlots = remaining.filter((r) => r.type === "group");
      expect(groupSlots.length).toBeGreaterThanOrEqual(2);
      const electiveSlots = remaining.filter((r) => r.type === "discipline_elective");
      expect(electiveSlots.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("computeRequirementTreeWithStatus", () => {
  const cache = buildDataCache(minimalCatalogue, emptySchedules);

  it("returns tree with same root length as program requirements", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
        { type: "course", code: normalizeCourseCode("ESL 2121"), credits: 3 },
      ],
    };
    const tree = computeRequirementTreeWithStatus(program, [], cache);
    expect(tree).toHaveLength(2);
  });

  it("marks course node complete and sets satisfiedBy when completed", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [{ type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 }],
    };
    const tree = computeRequirementTreeWithStatus(
      program,
      [normalizeCourseCode("ESL 2100")],
      cache,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].complete).toBe(true);
    expect(tree[0].satisfiedBy).toEqual([normalizeCourseCode("ESL 2100")]);
  });

  it("marks course node incomplete with requirementId when not completed", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [{ type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 }],
    };
    const tree = computeRequirementTreeWithStatus(program, [], cache);
    expect(tree[0].complete).toBe(false);
    expect(tree[0].requirementId).toBeDefined();
    expect(tree[0].satisfiedBy).toEqual([]);
  });

  it("or_group stays incomplete when one option completed (user assigns explicitly)", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        {
          type: "or_group",
          title: "or",
          options: [
            { type: "course", code: normalizeCourseCode("ESL 2100") },
            { type: "course", code: normalizeCourseCode("ESL 2121") },
          ],
        },
      ],
    };
    const tree = computeRequirementTreeWithStatus(
      program,
      [normalizeCourseCode("ESL 2121")],
      cache,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("or_group");
    expect(tree[0].complete).toBe(false);
    expect(tree[0].satisfiedOptionIndex).toBeUndefined();
    expect(tree[0].satisfiedBy).toEqual([]);
    expect(tree[0].options).toHaveLength(2);
    expect(tree[0].requirementId).toBeDefined();
    expect(tree[0].candidateCourses).toContain(normalizeCourseCode("ESL 2100"));
    expect(tree[0].candidateCourses).toContain(normalizeCourseCode("ESL 2121"));
  });

  it("or_group option children expose selectable requirement slots when incomplete", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        {
          type: "or_group",
          title: "One of",
          options: [
            { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
            { type: "course", code: normalizeCourseCode("ESL 2121"), credits: 3 },
          ],
        },
      ],
    };
    const tree = computeRequirementTreeWithStatus(program, [], cache);
    expect(tree).toHaveLength(1);
    const group = tree[0];
    expect(group.type).toBe("or_group");
    expect(group.complete).toBe(false);
    expect(group.options).toBeDefined();
    expect(group.options!.length).toBe(2);
    for (const opt of group.options!) {
      // Each option should have its own requirementId and candidate list so the UI
      // can render a per-option dropdown and progress.
      expect(opt.requirementId).toBeDefined();
      expect(opt.candidateCourses).toBeDefined();
      expect(opt.candidateCourses!.length).toBeGreaterThan(0);
      expect(opt.creditsNeeded).toBeGreaterThan(0);
    }
  });

  it("options_group stays incomplete when one branch would be satisfied (user assigns explicitly)", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        {
          type: "options_group",
          title: "One option:",
          options: [
            { type: "and", options: [{ type: "course", code: normalizeCourseCode("ESL 2100") }] },
            { type: "and", options: [{ type: "course", code: normalizeCourseCode("ESL 2121") }] },
          ],
        },
      ],
    };
    const tree = computeRequirementTreeWithStatus(
      program,
      [normalizeCourseCode("ESL 2100")],
      cache,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("options_group");
    expect(tree[0].complete).toBe(false);
    expect(tree[0].satisfiedBy).toEqual([]);
  });

  it("emits nested remaining requirements for the selected options_group branch only", () => {
    const cat: Catalogue = {
      ...minimalCatalogue,
      courses: [
        ...minimalCatalogue.courses,
        {
          code: normalizeCourseCode("SEG 3100"),
          title: normalizeCourseCode("SEG 3100"),
          credits: 3,
          description: "",
          component: "LEC",
        },
      ],
    };
    const segCache = buildDataCache(cat, emptySchedules);
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        {
          type: "options_group",
          title: "Choose",
          options: [
            {
              type: "and",
              options: [
                {
                  type: "discipline_elective",
                  title: normalizeCourseCode("SEG 3000"),
                  credits: 3,
                  disciplineLevels: [{ discipline: "SEG", levels: [3000] }],
                },
              ],
            },
            {
              type: "and",
              options: [{ type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 }],
            },
          ],
        },
        {
          type: "free_elective",
          title: "Free",
          credits: 3,
        },
      ],
    };

    const noSelection = computeRemainingRequirements(program, [], segCache);
    expect(noSelection.some((r) => r.requirementId === "req-0-0-0")).toBe(false);

    const withSelection = computeRemainingRequirements(program, [], segCache, {
      "req-0": 0,
    });
    expect(withSelection.some((r) => r.requirementId === "req-0-0-0")).toBe(true);
    expect(withSelection.some((r) => r.requirementId === "req-1")).toBe(true);
  });
});

describe("collectCompletedRequirements", () => {
  const cache = buildDataCache(minimalCatalogue, emptySchedules);

  it("returns one item per top-level completed requirement with satisfiedBy", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
        { type: "course", code: normalizeCourseCode("ESL 2121"), credits: 3 },
      ],
    };
    const tree = computeRequirementTreeWithStatus(
      program,
      [normalizeCourseCode("ESL 2100"), normalizeCourseCode("ESL 2121")],
      cache,
    );
    const completed = collectCompletedRequirements(tree);
    expect(completed).toHaveLength(2);
    expect(completed[0].satisfiedBy).toBeDefined();
    expect(completed.some((c) => c.satisfiedBy.includes(normalizeCourseCode("ESL 2100")))).toBe(
      true,
    );
    expect(completed.some((c) => c.satisfiedBy.includes(normalizeCourseCode("ESL 2121")))).toBe(
      true,
    );
  });

  it("or_group root is incomplete when option completed; completed list may contain child course", () => {
    const program: Program = {
      title: "Test",
      url: "",
      requirements: [
        {
          type: "or_group",
          title: "One of",
          options: [
            { type: "course", code: normalizeCourseCode("ESL 2100") },
            { type: "course", code: normalizeCourseCode("ESL 2121") },
          ],
        },
      ],
    };
    const tree = computeRequirementTreeWithStatus(
      program,
      [normalizeCourseCode("ESL 2100")],
      cache,
    );
    expect(tree[0].complete).toBe(false);
    const completed = collectCompletedRequirements(tree);
    // or_group itself is not complete; child course node may appear as completed when walking tree
    expect(completed.length).toBeLessThanOrEqual(1);
  });
});

describe("repeatable courses (accompanying FLS)", () => {
  const cache = buildDataCache(minimalCatalogue, emptySchedules);

  // Two separate requirement slots that both accept the same repeatable companion course.
  const program: Program = {
    title: "Test",
    url: "",
    requirements: [
      { type: "course", code: normalizeCourseCode("FLS 2581"), credits: 3 },
      { type: "course", code: normalizeCourseCode("FLS 2581"), credits: 3 },
    ],
  };

  it("a single instance satisfies only one of two slots", () => {
    const remaining = computeRemainingRequirements(
      program,
      [normalizeCourseCode("FLS 2581")],
      cache,
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].candidateCourses).toEqual([normalizeCourseCode("FLS 2581")]);
  });

  it("a repeated instance satisfies both slots", () => {
    const remaining = computeRemainingRequirements(
      program,
      [normalizeCourseCode("FLS 2581"), normalizeCourseCode("FLS 2581")],
      cache,
    );
    expect(remaining).toHaveLength(0);
  });

  it("non-repeatable duplicates still satisfy only one slot", () => {
    const eslProgram: Program = {
      title: "Test",
      url: "",
      requirements: [
        { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
        { type: "course", code: normalizeCourseCode("ESL 2100"), credits: 3 },
      ],
    };
    // A non-repeatable course is capped at one instance in the pool, so a stray duplicate
    // (e.g. from a hand-crafted share URL) can never over-satisfy: one slot stays remaining.
    const remaining = computeRemainingRequirements(
      eslProgram,
      [normalizeCourseCode("ESL 2100"), normalizeCourseCode("ESL 2100")],
      cache,
    );
    expect(remaining).toHaveLength(1);
  });
});

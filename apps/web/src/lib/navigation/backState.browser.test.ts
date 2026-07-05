import { expect, test } from "vitest";
import { buildProfessorRegistry, unsafeBrand } from "@uoplan/core";
import type { ProfessorSlug } from "@uoplan/core";
import { locationLabel } from "./backState";
import { testProfessorName } from "../../test/brands";

test("locationLabel names each top-level section by path", () => {
  expect(locationLabel("/")).toBe("Home");
  expect(locationLabel("/explore")).toBe("Course explorer");
  expect(locationLabel("/personalize")).toBe("Personalize");
  expect(locationLabel("/schedule")).toBe("Schedule generator");
  // The degree-planner graph is named distinctly from the generic schedule section,
  // so back buttons that return to it don't mislabel it as "Schedule generator".
  expect(locationLabel("/schedule/graph")).toBe("Degree planner");
  expect(locationLabel("/trends")).toBe("Trends");
  expect(locationLabel("/professor-graph")).toBe("Professor network");
  expect(locationLabel("/donate")).toBe("Support us");
  expect(locationLabel("/changelog")).toBe("Changelog");
  // Unknown destinations fall back to the home label rather than throwing.
  expect(locationLabel("/somewhere/else")).toBe("Home");
});

test("locationLabel names an Explore course detail by its code from the URL alone", () => {
  expect(locationLabel("/explore/course/MAT1320")).toBe("MAT 1320");
  // Compact lowercase path params (as produced by courseNormToPathParam) resolve too.
  expect(locationLabel("/explore/course/csi4108")).toBe("CSI 4108");
  // Sub-routes of a course (schedule, feedback) keep the course code label.
  expect(locationLabel("/explore/course/csi4108/schedule")).toBe("CSI 4108");
  // An unparseable course segment falls back to the section label.
  expect(locationLabel("/explore/course/not-a-code")).toBe("Course explorer");
});

test("locationLabel refines an Explore destination by its search query", () => {
  expect(locationLabel("/explore", "?q=calculus")).toBe('Search results for "calculus"');
  // A blank or absent query keeps the plain section name.
  expect(locationLabel("/explore", "?q=")).toBe("Course explorer");
  expect(locationLabel("/explore", "?type=course")).toBe("Course explorer");
  expect(locationLabel("/explore", "")).toBe("Course explorer");
});

test("locationLabel names an Explore professor detail by their canonical name via the registry", () => {
  const registry = buildProfessorRegistry([
    {
      slug: unsafeBrand<ProfessorSlug>("ada-lovelace"),
      name: testProfessorName("Ada Lovelace"),
      legacyIds: [123],
      aliases: [],
    },
  ]);

  // The URL only carries the slug; the registry resolves it to the real name.
  expect(locationLabel("/explore/professor/ada-lovelace", "", registry)).toBe("Ada Lovelace");
  // A numeric legacyId param resolves to the same professor.
  expect(locationLabel("/explore/professor/123", "", registry)).toBe("Ada Lovelace");
  // Sub-routes (e.g. feedback) keep the professor name.
  expect(locationLabel("/explore/professor/ada-lovelace/feedback", "", registry)).toBe(
    "Ada Lovelace",
  );
  // Without the registry (or for an unknown prof) it falls back to the section label
  // rather than surfacing a raw slug.
  expect(locationLabel("/explore/professor/ada-lovelace")).toBe("Course explorer");
  expect(locationLabel("/explore/professor/nobody-here", "", registry)).toBe("Course explorer");
});

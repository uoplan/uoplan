import { expect, test } from "vitest";
import { locationLabel } from "./backState";

test("locationLabel names each top-level section by path", () => {
  expect(locationLabel("/")).toBe("Home");
  expect(locationLabel("/explore")).toBe("Course explorer");
  expect(locationLabel("/explore/course/MAT1320")).toBe("Course explorer");
  expect(locationLabel("/personalize")).toBe("Personalize");
  expect(locationLabel("/schedule")).toBe("Schedule generator");
  expect(locationLabel("/trends")).toBe("Trends");
  expect(locationLabel("/graph")).toBe("Professor network");
  expect(locationLabel("/donate")).toBe("Support us");
  expect(locationLabel("/changelog")).toBe("Changelog");
  // Unknown destinations fall back to the home label rather than throwing.
  expect(locationLabel("/somewhere/else")).toBe("Home");
});

test("locationLabel refines an Explore destination by its search query", () => {
  expect(locationLabel("/explore", "?q=calculus")).toBe('Search results for "calculus"');
  // A blank or absent query keeps the plain section name.
  expect(locationLabel("/explore", "?q=")).toBe("Course explorer");
  expect(locationLabel("/explore", "?type=course")).toBe("Course explorer");
  expect(locationLabel("/explore", "")).toBe("Course explorer");
});

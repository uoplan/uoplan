import { describe, expect, it } from "vitest";

import { routePath } from "./routes";
import type { AppRoute } from "./routes";

describe("routePath", () => {
  it("builds static paths", () => {
    expect(routePath({ name: "home" })).toBe("/");
    expect(routePath({ name: "schedule" })).toBe("/schedule");
    expect(routePath({ name: "trends" })).toBe("/trends");
    expect(routePath({ name: "trendsCourses" })).toBe("/trends/courses");
    expect(routePath({ name: "donate" })).toBe("/donate");
    expect(routePath({ name: "changelog" })).toBe("/changelog");
  });

  it("encodes dynamic segments", () => {
    expect(routePath({ name: "course", course: "MAT 1320" })).toBe("/explore/course/MAT%201320");
    expect(routePath({ name: "discipline", discipline: "ITI" })).toBe("/explore/discipline/ITI");
    expect(routePath({ name: "professor", slug: "jane-doe" })).toBe("/explore/professor/jane-doe");
  });

  it("keeps multi-segment program paths split (each segment encoded)", () => {
    expect(routePath({ name: "program", path: "honours/computer science" })).toBe(
      "/explore/program/honours/computer%20science",
    );
  });

  it("appends optional query strings only when present", () => {
    expect(routePath({ name: "explore" })).toBe("/explore");
    expect(routePath({ name: "explore", query: "" })).toBe("/explore");
    expect(routePath({ name: "explore", query: "data structures" })).toBe(
      "/explore?q=data%20structures",
    );
    expect(routePath({ name: "personalize" })).toBe("/personalize");
    expect(routePath({ name: "personalize", step: "program" })).toBe("/personalize?step=program");
    expect(routePath({ name: "graph", professor: "a&b" })).toBe("/graph?prof=a%26b");
  });

  it("is exhaustive over every route name", () => {
    const samples: AppRoute[] = [
      { name: "home" },
      { name: "explore" },
      { name: "course", course: "x" },
      { name: "discipline", discipline: "x" },
      { name: "faculty", faculty: "x" },
      { name: "professor", slug: "x" },
      { name: "program", path: "x" },
      { name: "trends" },
      { name: "trendsCourses" },
      { name: "trendsDisciplines" },
      { name: "trendsLeaderboard" },
      { name: "personalize" },
      { name: "schedule" },
      { name: "graph" },
      { name: "donate" },
      { name: "changelog" },
    ];
    for (const route of samples) {
      expect(routePath(route).startsWith("/")).toBe(true);
    }
  });

  describe("school-prefix design", () => {
    it("produces basepath-relative paths with no school prefix", () => {
      // routePath is intentionally school-neutral. The school prefix is the
      // adapter's responsibility:
      //   - Web (WebNavigationProvider): withBasepath(router.basepath, routePath(route))
      //   - Native (NativeNavigationProvider): routePath(route) directly as Expo Href
      //     (native bundles uOttawa-only data, so no prefix is ever needed).
      // uOttawa's pathSlug is "", so withBasepath is a no-op — existing URLs stay intact.
      expect(routePath({ name: "schedule" })).toBe("/schedule");
      expect(routePath({ name: "explore" })).toBe("/explore");
      expect(routePath({ name: "home" })).toBe("/");

      // Paths must never embed a school slug
      for (const route of [
        { name: "schedule" as const },
        { name: "explore" as const },
        { name: "trends" as const },
        { name: "personalize" as const },
      ]) {
        const path = routePath(route);
        expect(path).not.toContain("uottawa");
        expect(path).not.toContain("carleton");
      }
    });
  });
});

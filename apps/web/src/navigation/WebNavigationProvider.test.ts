import { describe, expect, it } from "vitest";
import { withBasepath } from "./basepath";

describe("withBasepath", () => {
  it("leaves paths untouched for the default (unprefixed) school", () => {
    expect(withBasepath(undefined, "/schedule")).toBe("/schedule");
    expect(withBasepath("", "/schedule")).toBe("/schedule");
    expect(withBasepath("/", "/")).toBe("/");
  });

  it("prefixes paths for a school mounted at a subpath", () => {
    expect(withBasepath("/carleton", "/schedule")).toBe("/carleton/schedule");
    expect(withBasepath("/carleton", "/explore?q=comp")).toBe("/carleton/explore?q=comp");
  });

  it("does not emit a double slash for the root path", () => {
    expect(withBasepath("/carleton", "/")).toBe("/carleton");
    expect(withBasepath("/carleton/", "/")).toBe("/carleton");
    expect(withBasepath("/carleton/", "/schedule")).toBe("/carleton/schedule");
  });
});

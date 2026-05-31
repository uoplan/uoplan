import { describe, expect, it } from "vitest";
import { APP_DESTINATIONS, destinationForNavKey } from "./appDestinations";

describe("appDestinations", () => {
  it("has unique ids, routes and nav keys", () => {
    const ids = APP_DESTINATIONS.map((d) => d.id);
    const routes = APP_DESTINATIONS.map((d) => d.to);
    const navKeys = APP_DESTINATIONS.map((d) => d.navKey);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(navKeys).size).toBe(navKeys.length);
  });

  it("uses single lowercase-letter nav keys", () => {
    for (const dest of APP_DESTINATIONS) {
      expect(dest.navKey).toMatch(/^[a-z]$/);
    }
  });

  it("populates label, description and keywords for every destination", () => {
    for (const dest of APP_DESTINATIONS) {
      expect(dest.labelId.length).toBeGreaterThan(0);
      expect(dest.descriptionId.length).toBeGreaterThan(0);
      expect(dest.keywords.length).toBeGreaterThan(0);
    }
  });

  it("resolves a destination from its nav key, case-insensitively", () => {
    const explore = APP_DESTINATIONS.find((d) => d.id === "explore")!;
    expect(destinationForNavKey("e")).toBe(explore);
    expect(destinationForNavKey("E")).toBe(explore);
  });

  it("returns null for an unknown nav key", () => {
    expect(destinationForNavKey("z")).toBeNull();
    expect(destinationForNavKey("")).toBeNull();
  });
});

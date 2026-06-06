import { describe, expect, it, vi } from "vitest";
import { buildSecretCommands, matchSecretCommands } from "./secretCommands";

const commands = buildSecretCommands({ unlockGeegees: () => {} });

describe("matchSecretCommands", () => {
  it("returns nothing for a blank or too-short query", () => {
    expect(matchSecretCommands(commands, "")).toEqual([]);
    expect(matchSecretCommands(commands, "ge")).toEqual([]);
  });

  it("reveals the Gee-Gees theme for geegees variants", () => {
    expect(matchSecretCommands(commands, "geegees").map((c) => c.id)).toContain("secret-geegees");
    expect(matchSecretCommands(commands, "go gees").map((c) => c.id)).toContain("secret-geegees");
  });

  it("returns nothing for an unrelated query", () => {
    expect(matchSecretCommands(commands, "schedule")).toEqual([]);
  });

  it("wires the geegees handler through to run()", () => {
    const unlockGeegees = vi.fn();
    const built = buildSecretCommands({ unlockGeegees });
    built.find((c) => c.id === "secret-geegees")?.run();
    expect(unlockGeegees).toHaveBeenCalledOnce();
  });
});

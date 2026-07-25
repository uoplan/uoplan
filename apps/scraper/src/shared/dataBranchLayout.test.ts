import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSchoolSources } from "./dataBranchLayout.ts";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "data-branch-"));
}

describe("discoverSchoolSources", () => {
  it("finds every school directory on a namespaced data branch", () => {
    const root = scratch();
    for (const school of ["uottawa", "carleton"]) {
      mkdirSync(join(root, school, "catalogue"), { recursive: true });
      writeFileSync(join(root, school, "terms.json"), "{}");
    }

    expect(discoverSchoolSources(root)).toEqual([
      ["carleton", join(root, "carleton")],
      ["uottawa", join(root, "uottawa")],
    ]);
  });

  it("maps a legacy flat data branch onto the default school", () => {
    const root = scratch();
    mkdirSync(join(root, "catalogue"), { recursive: true });
    writeFileSync(join(root, "terms.json"), "{}");

    expect(discoverSchoolSources(root)).toEqual([["uottawa", root]]);
  });

  it("ignores directories that are not known school ids", () => {
    const root = scratch();
    mkdirSync(join(root, "carleton"), { recursive: true });
    mkdirSync(join(root, "raw"), { recursive: true });
    mkdirSync(join(root, "node_modules"), { recursive: true });

    expect(discoverSchoolSources(root).map(([school]) => school)).toEqual(["carleton"]);
  });
});

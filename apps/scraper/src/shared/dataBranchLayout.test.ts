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

  it("finds both schools while the default school is still flat at the root", () => {
    // The real state of the `data` branch the moment a second school is first
    // scraped: the new school lands in its own directory, but uOttawa's files
    // are still flat at the root and only get migrated on its next scrape.
    // Treating the presence of *any* school directory as "fully namespaced"
    // silently drops uOttawa from every build.
    const root = scratch();
    mkdirSync(join(root, "carleton", "catalogue"), { recursive: true });
    writeFileSync(join(root, "carleton", "terms.json"), "{}");
    mkdirSync(join(root, "catalogue"), { recursive: true });
    writeFileSync(join(root, "catalogue", "catalogue.json"), "{}");
    writeFileSync(join(root, "terms.json"), "{}");

    expect(discoverSchoolSources(root)).toEqual([
      ["carleton", join(root, "carleton")],
      ["uottawa", root],
    ]);
  });

  it("does not invent a flat default school from unrelated stray files", () => {
    // A fully migrated branch has school directories and no root data markers;
    // leftovers like a README must not resurrect a phantom uOttawa source.
    const root = scratch();
    mkdirSync(join(root, "carleton", "catalogue"), { recursive: true });
    writeFileSync(join(root, "carleton", "terms.json"), "{}");
    writeFileSync(join(root, "README.md"), "notes");

    expect(discoverSchoolSources(root)).toEqual([["carleton", join(root, "carleton")]]);
  });

  it("prefers the namespaced directory when the default school exists in both places", () => {
    // Mid-migration: files copied into `uottawa/` but not yet deleted from the
    // root. The namespaced copy is the migrated one and must win.
    const root = scratch();
    mkdirSync(join(root, "uottawa", "catalogue"), { recursive: true });
    writeFileSync(join(root, "uottawa", "terms.json"), "{}");
    writeFileSync(join(root, "terms.json"), "{}");

    expect(discoverSchoolSources(root)).toEqual([["uottawa", join(root, "uottawa")]]);
  });
});

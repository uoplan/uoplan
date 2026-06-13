import { parseChangelog } from "@/lib/changelog";

const SAMPLE = `# Changelog

## [1.2.0](https://example.com/compare/v1.1.0...v1.2.0) (2026-06-13)


### Features

* add global course cart ([78bdd21](https://example.com/commit/78bdd21))
* **web:** shared BottomDrawer fixes full-width mobile sheet ([40f2e55](https://example.com/commit/40f2e55))


### Bug Fixes

* ci ([d61c639](https://example.com/commit/d61c639))


## 1.1.0 (2026-05-01)

### Features

* first release ([abc1234](https://example.com/commit/abc1234))
`;

describe("parseChangelog", () => {
  const releases = parseChangelog(SAMPLE);

  it("parses each release header with version + date", () => {
    expect(releases).toHaveLength(2);
    expect(releases[0].version).toBe("1.2.0");
    expect(releases[0].date).toBe("2026-06-13");
    expect(releases[1].version).toBe("1.1.0");
  });

  it("groups entries under their sections", () => {
    const [latest] = releases;
    expect(latest.sections.map((s) => s.title)).toEqual(["Features", "Bug Fixes"]);
    expect(latest.sections[0].entries).toHaveLength(2);
    expect(latest.sections[1].entries).toHaveLength(1);
  });

  it("extracts commit hash and conventional scope, stripping markup", () => {
    const features = releases[0].sections[0].entries;
    expect(features[0]).toEqual({
      text: "add global course cart",
      scope: undefined,
      hash: "78bdd21",
    });
    expect(features[1]).toEqual({
      text: "shared BottomDrawer fixes full-width mobile sheet",
      scope: "web",
      hash: "40f2e55",
    });
  });

  it("drops releases/sections with no entries", () => {
    const empty = parseChangelog("# Changelog\n\n## 9.9.9 (2026-01-01)\n\n### Features\n");
    expect(empty).toHaveLength(0);
  });
});

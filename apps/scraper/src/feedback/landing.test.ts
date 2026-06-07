import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLandingTermLinks } from "./landing.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = await fs.readFile(path.join(__dirname, "__fixtures__", "landing.html"), "utf-8");

describe("parseLandingTermLinks", () => {
  const links = parseLandingTermLinks(html);

  it("extracts every distinct term and maps it to a STRM id", () => {
    expect(links.length).toBeGreaterThan(20);
    const byId = new Map(links.map((l) => [l.termId, l]));
    expect(byId.get("2259")?.label).toBe("Fall 2025");
    expect(byId.get("2261")?.label).toBe("Winter 2026");
    expect(byId.get("2249")?.label).toBe("Fall 2024");
  });

  it("only returns https Bluera links", () => {
    for (const l of links) {
      expect(l.url.startsWith("https://uottawa.bluera.com/")).toBe(true);
    }
  });

  it("flags the legacy rpvlf viewer", () => {
    const springSummer2023 = links.find((l) => l.label === "Spring/Summer 2023");
    expect(springSummer2023?.legacy).toBe(true);
  });

  it("does not produce duplicate term ids", () => {
    const ids = links.map((l) => l.termId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

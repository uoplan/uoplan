import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildProfessorRegistry } from "../../professors/buildRegistry.ts";
import { getRateMyProfessorsSchoolNodeId } from "../../ratemyprofessors/scrape.ts";
import { CARLETON_RMP_SCHOOL_ID, normalizeCarletonInstructorName } from "./rateMyProfessors.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "__fixtures__");

// ---------------------------------------------------------------------------
// School node id constants
// ---------------------------------------------------------------------------

describe("Carleton RateMyProfessors constants", () => {
  it("exports the correct numeric school id", () => {
    expect(CARLETON_RMP_SCHOOL_ID).toBe(1420);
  });

  // The node id is derived from the numeric id rather than stored, so pin it
  // against the literal RateMyProfessors actually serves.
  it("derives the GraphQL node id as base64 of School-1420", () => {
    expect(getRateMyProfessorsSchoolNodeId("carleton")).toBe("U2Nob29sLTE0MjA=");
    expect(atob(getRateMyProfessorsSchoolNodeId("carleton"))).toBe("School-1420");
  });

  it("derives uOttawa's node id from its own id, not Carleton's", () => {
    expect(getRateMyProfessorsSchoolNodeId("uottawa")).toBe("U2Nob29sLTE0NTI=");
    expect(atob(getRateMyProfessorsSchoolNodeId("uottawa"))).toBe("School-1452");
  });
});

// ---------------------------------------------------------------------------
// Instructor name normalisation
// ---------------------------------------------------------------------------

describe("normalizeCarletonInstructorName", () => {
  it("passes through a well-formed 'First Last' name unchanged", () => {
    expect(normalizeCarletonInstructorName("John Smith")).toBe("John Smith");
  });

  it("converts 'Surname, First' to 'First Surname'", () => {
    expect(normalizeCarletonInstructorName("Smith, John")).toBe("John Smith");
  });

  it("converts 'Surname, First Middle' to 'First Middle Surname'", () => {
    expect(normalizeCarletonInstructorName("Doe, Jane Marie")).toBe("Jane Marie Doe");
  });

  it("title-cases a fully lowercase surname token (data anomaly)", () => {
    // Banner sometimes emits 'smith, John' instead of 'Smith, John'
    expect(normalizeCarletonInstructorName("smith, John")).toBe("John Smith");
  });

  it("title-cases a fully lowercase given token (data anomaly)", () => {
    expect(normalizeCarletonInstructorName("Smith, john")).toBe("John Smith");
  });

  it("title-cases fully-lowercase 'Last, First' where both tokens are lowercase", () => {
    // 'smith, john' (all-lowercase Banner anomaly) → title-case both tokens
    expect(normalizeCarletonInstructorName("smith, john")).toBe("John Smith");
  });

  it("preserves intentional mixed-case like MacNeil", () => {
    expect(normalizeCarletonInstructorName("MacNeil, James")).toBe("James MacNeil");
  });

  it("preserves hyphenated surnames", () => {
    expect(normalizeCarletonInstructorName("Saint-Amant, Alain")).toBe("Alain Saint-Amant");
  });

  it("handles leading/trailing whitespace", () => {
    expect(normalizeCarletonInstructorName("  Smith, John  ")).toBe("John Smith");
  });

  it("handles extra internal spaces", () => {
    expect(normalizeCarletonInstructorName("Smith,  John")).toBe("John Smith");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeCarletonInstructorName("")).toBe("");
    expect(normalizeCarletonInstructorName("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Name matching with the professor registry
// ---------------------------------------------------------------------------

describe("Carleton professor name matching", () => {
  it("matches a 'Surname, First' schedule instructor to its RMP entry", () => {
    // Simulate: schedule has 'Smith, John', RMP has 'John Smith'
    const registry = buildProfessorRegistry({
      rmp: [{ name: "John Smith", legacyId: 101, rating: 4.2, numRatings: 15 }],
      grades: [],
      schedules: [normalizeCarletonInstructorName("Smith, John")],
      feedback: [],
    });
    const entry = registry.find((e) => e.slug === "john-smith");
    expect(entry).toBeDefined();
    // Rating preserved — both strings collapse to the same match key after normalisation
    expect(entry?.rating).toBe(4.2);
  });

  it("matches a lowercase-surname anomaly after normalisation", () => {
    // 'smith, john' (all-lowercase Banner anomaly) → normalises to 'John Smith'
    // professorMatchKey('John Smith') === 'john|smith' === professorMatchKey('John Smith')
    const registry = buildProfessorRegistry({
      rmp: [{ name: "John Smith", legacyId: 101, rating: 4.2, numRatings: 15 }],
      grades: [],
      schedules: [normalizeCarletonInstructorName("smith, john")],
      feedback: [],
    });
    const entry = registry.find((e) => e.slug === "john-smith");
    expect(entry).toBeDefined();
    expect(entry?.rating).toBe(4.2);
  });

  it("loads the sample RMP fixture and builds a registry", () => {
    const fixture = JSON.parse(
      readFileSync(path.join(FIXTURES, "ratemyprofessors.sample.json"), "utf-8"),
    ) as {
      professors: Array<{
        name: string;
        legacyId: number;
        rating: number | null;
        numRatings: number;
      }>;
    };
    const registry = buildProfessorRegistry({
      rmp: fixture.professors,
      grades: [],
      schedules: [],
      feedback: [],
    });
    expect(registry.length).toBe(fixture.professors.length);
    const smith = registry.find((e) => e.slug === "john-smith");
    expect(smith).toBeDefined();
    expect(smith?.rating).toBe(4.2);
    expect(smith?.numRatings).toBe(15);
    // Professor with null rating must not emit a rating field
    const vargas = registry.find((e) => e.slug === "carlos-vargas");
    expect(vargas).toBeDefined();
    expect(vargas?.rating).toBeUndefined();
  });
});

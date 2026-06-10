import { describe, expect, it } from "vitest";
import {
  deburr,
  pickCanonicalProfessorName,
  professorMatchKey,
  professorNameTokens,
  slugifyProfessor,
} from "../professorIdentity";

describe("deburr", () => {
  it("strips combining diacritical marks", () => {
    expect(deburr("Geneviève")).toBe("Genevieve");
    expect(deburr("José Morán")).toBe("Jose Moran");
  });
});

describe("professorNameTokens", () => {
  it("lowercases and splits on punctuation", () => {
    expect(professorNameTokens("Alain St-Amant")).toEqual(["alain", "st", "amant"]);
    expect(professorNameTokens("O'Brien, Renée")).toEqual(["o", "brien", "renee"]);
  });
});

describe("professorMatchKey", () => {
  it("merges diacritic and middle-name variants to one key", () => {
    expect(professorMatchKey("Geneviève Tellier")).toBe("genevieve|tellier");
    expect(professorMatchKey("Genevieve Tellier")).toBe("genevieve|tellier");
    expect(professorMatchKey("Andrea Siebra Vinet")).toBe("andrea|vinet");
    expect(professorMatchKey("Andréa Vinet")).toBe("andrea|vinet");
  });

  it("collapses hyphenated and particle surnames via last token", () => {
    expect(professorMatchKey("Alain Saint-Amant")).toBe("alain|amant");
    expect(professorMatchKey("Alain St-Amant")).toBe("alain|amant");
    expect(professorMatchKey("Carlos Da Silva")).toBe("carlos|silva");
    expect(professorMatchKey("Carlos Gomes Da Silva")).toBe("carlos|silva");
  });

  it("handles single-token and empty names", () => {
    expect(professorMatchKey("Cher")).toBe("cher");
    expect(professorMatchKey("")).toBe("");
    expect(professorMatchKey("   ")).toBe("");
  });
});

describe("pickCanonicalProfessorName", () => {
  it("prefers more tokens (keeps middle names)", () => {
    expect(pickCanonicalProfessorName(["Andréa Vinet", "Andrea Siebra Vinet"])).toBe(
      "Andrea Siebra Vinet",
    );
  });

  it("prefers accented spelling when token counts tie", () => {
    expect(pickCanonicalProfessorName(["Genevieve Tellier", "Geneviève Tellier"])).toBe(
      "Geneviève Tellier",
    );
  });

  it("trims stray trailing commas", () => {
    expect(pickCanonicalProfessorName(["Rosalinde Klempan,", "Rosalinde Klempan"])).toBe(
      "Rosalinde Klempan",
    );
  });

  it("trims stray leading periods and commas", () => {
    expect(pickCanonicalProfessorName([".Rosalinde Klempan"])).toBe("Rosalinde Klempan");
    expect(pickCanonicalProfessorName([",Jean Tremblay."])).toBe("Jean Tremblay");
  });

  it("is deterministic for fully tied variants", () => {
    expect(pickCanonicalProfessorName(["Bob Lee", "Ann Lee"])).toBe(
      pickCanonicalProfessorName(["Ann Lee", "Bob Lee"]),
    );
  });
});

describe("slugifyProfessor", () => {
  it("produces kebab-case ascii slugs", () => {
    expect(slugifyProfessor("Geneviève Tellier")).toBe("genevieve-tellier");
    expect(slugifyProfessor("Alain Saint-Amant")).toBe("alain-saint-amant");
    expect(slugifyProfessor("O'Brien, Renée")).toBe("o-brien-renee");
  });
});

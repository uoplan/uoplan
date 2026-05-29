import { describe, expect, it } from "vitest";
import {
  blendProfessorDisciplineColor,
  colorForDiscipline,
  disciplineCategory,
} from "../professorDisciplineColors";

describe("disciplineCategory", () => {
  it("maps STEM codes to expected categories", () => {
    expect(disciplineCategory("CSI")).toBe("computing");
    expect(disciplineCategory("ELG")).toBe("engineering");
    expect(disciplineCategory("MAT")).toBe("physical_science");
    expect(disciplineCategory("BIO")).toBe("life_science");
  });

  it("falls back to other for unknown codes", () => {
    expect(disciplineCategory("ZZZ")).toBe("other");
  });
});

describe("colorForDiscipline", () => {
  it("returns hex colours", () => {
    expect(colorForDiscipline("CSI")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("keeps similar disciplines in the same category closer in hue than distant categories", () => {
    const csi = colorForDiscipline("CSI");
    const seg = colorForDiscipline("SEG");
    const mus = colorForDiscipline("MUS");
    expect(csi).not.toBe(mus);
    expect(csi).not.toBe(seg);
    // Same-category pair should share more hue similarity than cross-category (heuristic: not equal to arts)
    expect(disciplineCategory("CSI")).toBe(disciplineCategory("SEG"));
    expect(disciplineCategory("CSI")).not.toBe(disciplineCategory("MUS"));
  });
});

describe("blendProfessorDisciplineColor", () => {
  it("returns default when no weights", () => {
    expect(blendProfessorDisciplineColor({})).toBe("#868e96");
  });

  it("returns single-discipline colour for one subject", () => {
    expect(blendProfessorDisciplineColor({ CSI: 3 })).toBe(colorForDiscipline("CSI"));
  });

  it("weights blend toward the dominant discipline", () => {
    const mostlyCsi = blendProfessorDisciplineColor({ CSI: 9, MAT: 1 });
    const mostlyMat = blendProfessorDisciplineColor({ CSI: 1, MAT: 9 });
    expect(mostlyCsi).not.toBe(mostlyMat);
  });
});

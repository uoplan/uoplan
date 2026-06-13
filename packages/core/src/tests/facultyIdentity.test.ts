import { describe, expect, it } from "vitest";
import {
  cleanFacultyDisplayName,
  extractFacultyFromHeading,
  facultyIdFromName,
} from "../facultyIdentity";

describe("cleanFacultyDisplayName", () => {
  it("collapses whitespace, drops trailing period, strips the leading article", () => {
    expect(cleanFacultyDisplayName("the  Faculty of Science.")).toBe("Faculty of Science");
    expect(cleanFacultyDisplayName("la Faculté de génie", "fr")).toBe("Faculté de génie");
    expect(cleanFacultyDisplayName("l’École de gestion Telfer", "fr")).toBe(
      "École de gestion Telfer",
    );
  });
});

describe("facultyIdFromName", () => {
  it("collapses short and full forms to the same slug", () => {
    expect(facultyIdFromName("Science")).toBe("science");
    expect(facultyIdFromName("Faculty of Science")).toBe("science");
    expect(facultyIdFromName("the Faculty of Science")).toBe("science");
  });

  it("strips the School-of role prefix but keeps proper-noun schools intact", () => {
    expect(facultyIdFromName("Telfer School of Management")).toBe("telfer-school-of-management");
    expect(facultyIdFromName("School of Information Studies")).toBe("information-studies");
  });

  it("aliases the stray 'Faculty of Sciences' variant onto 'science'", () => {
    expect(facultyIdFromName("Faculty of Sciences")).toBe("science");
  });

  it("returns null for empty / role-only names", () => {
    expect(facultyIdFromName("")).toBeNull();
    expect(facultyIdFromName("   ")).toBeNull();
  });
});

describe("extractFacultyFromHeading", () => {
  it("parses the English 'offered by' heading", () => {
    expect(
      extractFacultyFromHeading(
        "Courses in computer science (CSI) are offered by the Faculty of Engineering",
        "en",
      ),
    ).toBe("Faculty of Engineering");
  });

  it("parses the French 'offerts par' heading", () => {
    expect(
      extractFacultyFromHeading(
        "Les cours en informatique (CSI) sont offerts par la Faculté de génie",
        "fr",
      ),
    ).toBe("Faculté de génie");
  });

  it("handles the singular 'is offered by' variant (e.g. Telfer)", () => {
    expect(
      extractFacultyFromHeading(
        "Courses in administration (ADM) are offered by the Telfer School of Management",
        "en",
      ),
    ).toBe("Telfer School of Management");
  });

  it("returns null when the heading has no offering clause", () => {
    expect(extractFacultyFromHeading("Some unrelated heading", "en")).toBeNull();
    expect(extractFacultyFromHeading("", "fr")).toBeNull();
  });
});

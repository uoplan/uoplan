import { describe, expect, it } from "vitest";

import { extractPrereqSentence, parseCoursePrerequisites } from "./prerequisites.ts";

describe("F1 leading one-of lists", () => {
  it("parses MAT 1320's leading one-of prerequisite as a disjunction", () => {
    expect(
      parseCoursePrerequisites(
        "One of MAT 1339, Ontario 4U Calculus and Vectors (MCV4U) or an equivalent",
      ),
    ).toEqual({
      type: "or_group",
      text: "One of MAT 1339, Ontario 4U Calculus and Vectors (MCV4U) or an equivalent",
      children: [
        { type: "course", code: "MAT 1339", text: "MAT 1339" },
        { type: "non_course", text: "Ontario 4U Calculus and Vectors (MCV4U)", kind: "highschool" },
        { type: "non_course", text: "an equivalent", kind: "equivalent" },
      ],
    });
  });
});

describe("F2 parenthesized disjunctions", () => {
  it("keeps ECO 3127's parenthesized math/statistics alternatives as an or_group", () => {
    expect(
      parseCoursePrerequisites(
        "ECO 2142, ECO 2144, and (ECO 2150 or MAT 1371 or MAT 1372 or MAT 2371 or MAT 2375 or MAT 2377 or MAT 2379 or ADM 2303 or ADM 2304 or HSS 2381 or PSY 2106)",
      ),
    ).toEqual({
      type: "and_group",
      text: "ECO 2142, ECO 2144, and (ECO 2150 or MAT 1371 or MAT 1372 or MAT 2371 or MAT 2375 or MAT 2377 or MAT 2379 or ADM 2303 or ADM 2304 or HSS 2381 or PSY 2106)",
      children: [
        { type: "course", code: "ECO 2142", text: "ECO 2142" },
        { type: "course", code: "ECO 2144", text: "ECO 2144" },
        {
          type: "or_group",
          text: "ECO 2150 or MAT 1371 or MAT 1372 or MAT 2371 or MAT 2375 or MAT 2377 or MAT 2379 or ADM 2303 or ADM 2304 or HSS 2381 or PSY 2106",
          children: [
            { type: "course", code: "ECO 2150", text: "ECO 2150" },
            { type: "course", code: "MAT 1371", text: "MAT 1371" },
            { type: "course", code: "MAT 1372", text: "MAT 1372" },
            { type: "course", code: "MAT 2371", text: "MAT 2371" },
            { type: "course", code: "MAT 2375", text: "MAT 2375" },
            { type: "course", code: "MAT 2377", text: "MAT 2377" },
            { type: "course", code: "MAT 2379", text: "MAT 2379" },
            { type: "course", code: "ADM 2303", text: "ADM 2303" },
            { type: "course", code: "ADM 2304", text: "ADM 2304" },
            { type: "course", code: "HSS 2381", text: "HSS 2381" },
            { type: "course", code: "PSY 2106", text: "PSY 2106" },
          ],
        },
      ],
    });
  });

  it("splits CRM 2707's French et while preserving the parenthesized ou", () => {
    expect(
      parseCoursePrerequisites("(CRM 1700 ou FEM 1500) et 18 crédits de cours universitaires"),
    ).toEqual({
      type: "and_group",
      text: "(CRM 1700 ou FEM 1500) et 18 crédits de cours universitaires",
      children: [
        {
          type: "or_group",
          text: "CRM 1700 ou FEM 1500",
          children: [
            { type: "course", code: "CRM 1700", text: "CRM 1700" },
            { type: "course", code: "FEM 1500", text: "FEM 1500" },
          ],
        },
        { type: "non_course", text: "18 crédits de cours universitaires", credits: 18 },
      ],
    });
  });

  it("splits English and before a parenthesized or_group", () => {
    expect(parseCoursePrerequisites("ESL 2181 and (ESL2351 or ESL2361)")).toEqual({
      type: "and_group",
      text: "ESL 2181 and (ESL2351 or ESL2361)",
      children: [
        { type: "course", code: "ESL 2181", text: "ESL 2181" },
        {
          type: "or_group",
          text: "ESL2351 or ESL2361",
          children: [
            { type: "course", code: "ESL 2351", text: "ESL2351" },
            { type: "course", code: "ESL 2361", text: "ESL2361" },
          ],
        },
      ],
    });
  });

  it("splits multi-and course clauses while preserving embedded parenthesized or_groups", () => {
    expect(
      parseCoursePrerequisites(
        "CSI 1100 and MAT 2341 and (MAT 2324 or MAT 2331) and MAT 2371 and MAT 2375",
      ),
    ).toEqual({
      type: "and_group",
      text: "CSI 1100 and MAT 2341 and (MAT 2324 or MAT 2331) and MAT 2371 and MAT 2375",
      children: [
        { type: "course", code: "CSI 1100", text: "CSI 1100" },
        { type: "course", code: "MAT 2341", text: "MAT 2341" },
        {
          type: "or_group",
          text: "MAT 2324 or MAT 2331",
          children: [
            { type: "course", code: "MAT 2324", text: "MAT 2324" },
            { type: "course", code: "MAT 2331", text: "MAT 2331" },
          ],
        },
        { type: "course", code: "MAT 2371", text: "MAT 2371" },
        { type: "course", code: "MAT 2375", text: "MAT 2375" },
      ],
    });
  });

  it("splits course and parenthesized or_group without splitting prose", () => {
    expect(parseCoursePrerequisites("GEG 2320 and (GEG 3312 or GEG 3105)")).toEqual({
      type: "and_group",
      text: "GEG 2320 and (GEG 3312 or GEG 3105)",
      children: [
        { type: "course", code: "GEG 2320", text: "GEG 2320" },
        {
          type: "or_group",
          text: "GEG 3312 or GEG 3105",
          children: [
            { type: "course", code: "GEG 3312", text: "GEG 3312" },
            { type: "course", code: "GEG 3105", text: "GEG 3105" },
          ],
        },
      ],
    });
    expect(parseCoursePrerequisites("Knowledge of probability and statistics")).toEqual({
      type: "non_course",
      text: "Knowledge of probability and statistics",
      kind: "knowledge",
    });
  });

  it("splits French et before an 11-way parenthesized ou group", () => {
    const ast = parseCoursePrerequisites(
      "ECO 2542, ECO 2544 et (ECO 2550 ou MAT 1771 ou MAT 1772 ou MAT 2771 ou MAT 2775 ou MAT 2777 ou MAT 2779 ou ADM 2703 ou ADM 2704 ou HSS 2781 ou PSY 2506)",
    );

    // Comma-separated segments stay grouped: "ECO 2544 et (…ou…)" nests as its own
    // and_group sibling of ECO 2542 (semantically AND-of-AND, identical to a flat list).
    expect(ast).toMatchObject({ type: "and_group" });
    expect(ast?.children?.[0]).toEqual({ type: "course", code: "ECO 2542", text: "ECO 2542" });
    const nested = ast?.children?.[1];
    expect(nested?.type).toBe("and_group");
    expect(nested?.children?.[0]).toEqual({ type: "course", code: "ECO 2544", text: "ECO 2544" });
    const orGroup = nested?.children?.find((child) => child.type === "or_group");
    expect(orGroup?.children).toEqual([
      { type: "course", code: "ECO 2550", text: "ECO 2550" },
      { type: "course", code: "MAT 1771", text: "MAT 1771" },
      { type: "course", code: "MAT 1772", text: "MAT 1772" },
      { type: "course", code: "MAT 2771", text: "MAT 2771" },
      { type: "course", code: "MAT 2775", text: "MAT 2775" },
      { type: "course", code: "MAT 2777", text: "MAT 2777" },
      { type: "course", code: "MAT 2779", text: "MAT 2779" },
      { type: "course", code: "ADM 2703", text: "ADM 2703" },
      { type: "course", code: "ADM 2704", text: "ADM 2704" },
      { type: "course", code: "HSS 2781", text: "HSS 2781" },
      { type: "course", code: "PSY 2506", text: "PSY 2506" },
    ]);
  });
});

describe("F3 or branches with one course and a credit clause", () => {
  it("keeps ART 4919's credit pool attached to the second alternative", () => {
    expect(
      parseCoursePrerequisites("ART 3916 ou ART 3917 et 3 crédits (P) de niveau 3000"),
    ).toEqual({
      type: "or_group",
      text: "ART 3916 ou ART 3917 et 3 crédits (P) de niveau 3000",
      children: [
        { type: "course", code: "ART 3916", text: "ART 3916" },
        {
          type: "and_group",
          text: "ART 3917 et 3 crédits (P) de niveau 3000",
          children: [
            { type: "course", code: "ART 3917" },
            {
              type: "non_course",
              text: "ART 3917 et 3 crédits (P) de niveau 3000",
              credits: 3,
              levels: [3000],
            },
          ],
        },
      ],
    });
  });

  it("does not attach creditless discipline labels to French program-context alternatives", () => {
    expect(
      parseCoursePrerequisites(
        "MCG2542, MCG3740 pour les étudiants en génie mécanique (MCG) ou CHG 2712 pour les étudiants en génie chimique (CHG)",
      ),
    ).toEqual({
      type: "and_group",
      text: "MCG2542, MCG3740 pour les étudiants en génie mécanique (MCG) ou CHG 2712 pour les étudiants en génie chimique (CHG)",
      children: [
        { type: "course", code: "MCG 2542", text: "MCG2542" },
        {
          type: "or_group",
          text: "MCG3740 pour les étudiants en génie mécanique (MCG) ou CHG 2712 pour les étudiants en génie chimique (CHG)",
          children: [
            {
              type: "course",
              code: "MCG 3740",
              text: "MCG3740 pour les étudiants en génie mécanique (MCG)",
            },
            {
              type: "course",
              code: "CHG 2712",
              text: "CHG 2712 pour les étudiants en génie chimique (CHG)",
            },
          ],
        },
      ],
    });
  });
});

describe("F4a explicit credit pools", () => {
  it("parses ART 2191 as credits from a listed set of courses", () => {
    expect(
      parseCoursePrerequisites("9 course units from ART 1311, ART1321, ART 1331, ART 1341"),
    ).toEqual({
      type: "non_course",
      text: "9 course units from ART 1311, ART1321, ART 1331, ART 1341",
      credits: 9,
      children: [
        { type: "course", code: "ART 1311" },
        { type: "course", code: "ART 1321" },
        { type: "course", code: "ART 1331" },
        { type: "course", code: "ART 1341" },
      ],
    });
  });

  it("keeps French parmi credit pools scoped to the listed courses", () => {
    expect(parseCoursePrerequisites("3 crédits de cours parmi MUS 1990, MUS 1591")).toEqual({
      type: "non_course",
      text: "3 crédits de cours parmi MUS 1990, MUS 1591",
      credits: 3,
      children: [
        { type: "course", code: "MUS 1990" },
        { type: "course", code: "MUS 1591" },
      ],
    });
  });

  it("keeps French parmis typo credit pools scoped to the listed courses", () => {
    expect(
      parseCoursePrerequisites(
        "3 crédits de cours parmis ART 1705, ART 1706, ART 1760, ou ART 1761",
      ),
    ).toEqual({
      type: "non_course",
      text: "3 crédits de cours parmis ART 1705, ART 1706, ART 1760, ou ART 1761",
      credits: 3,
      children: [
        { type: "course", code: "ART 1705" },
        { type: "course", code: "ART 1706" },
        { type: "course", code: "ART 1760" },
        { type: "course", code: "ART 1761" },
      ],
    });
  });

  it("does not scope global 81-credit gates to a following comma-separated APA course", () => {
    expect(parseCoursePrerequisites("81 crédits de cours universitaires, APA 2580")).toEqual({
      type: "and_group",
      text: "81 crédits de cours universitaires, APA 2580",
      children: [
        { type: "course", code: "APA 2580" },
        { type: "non_course", text: "81 crédits de cours universitaires, APA 2580", credits: 81 },
      ],
    });
  });

  it("does not scope global 54-credit gates to a following comma-separated APA course", () => {
    expect(parseCoursePrerequisites("54 crédits de cours universitaires, APA 2534")).toEqual({
      type: "and_group",
      text: "54 crédits de cours universitaires, APA 2534",
      children: [
        { type: "course", code: "APA 2534" },
        { type: "non_course", text: "54 crédits de cours universitaires, APA 2534", credits: 54 },
      ],
    });
  });
});

describe("F4b including credit gates", () => {
  it("parses APA 4501 as a global credit gate and an included alternative", () => {
    expect(
      parseCoursePrerequisites("54 crédits universitaires incluant APA 1702 ou LSR 1500"),
    ).toEqual({
      type: "and_group",
      text: "54 crédits universitaires incluant APA 1702 ou LSR 1500",
      children: [
        { type: "non_course", text: "54 crédits universitaires", credits: 54 },
        {
          type: "or_group",
          text: "APA 1702 ou LSR 1500",
          children: [
            { type: "course", code: "APA 1702", text: "APA 1702" },
            { type: "course", code: "LSR 1500", text: "LSR 1500" },
          ],
        },
      ],
    });
  });
});

describe("F5 prerequisite label typos", () => {
  it("recognizes ALG 4905's misspelled English label and keeps only the first language", () => {
    const sentence = extractPrereqSentence(
      "Cours magistral / LecturePréalable : ALG 3901 ou l'équivalent et permission du Département. / Prererequisite: ALG 3901 or equivalent and permission of the Department.",
    );
    expect(sentence).toBe("ALG 3901 ou l'équivalent et permission du Département");
    expect(parseCoursePrerequisites(sentence ?? "")).toEqual({
      type: "or_group",
      text: "ALG 3901 ou l'équivalent et permission du Département",
      children: [
        { type: "course", code: "ALG 3901", text: "ALG 3901" },
        {
          type: "non_course",
          text: "l'équivalent et permission du Département",
          kind: "permission",
        },
      ],
    });
  });

  it("leaves ESP 2991's already-correct French-first extraction unchanged", () => {
    expect(
      extractPrereqSentence(
        "Cours magistral / LecturePréalable : ESP 1992 ou permission du Département. / Prerequisite: ESP 1992 or permission of the Department.",
      ),
    ).toBe("ESP 1992 ou permission du Département");
  });

  it("leaves CSI 3105's legitimate repeated CSI 2110 parse unchanged", () => {
    expect(
      parseCoursePrerequisites(
        "CSI 2110, CSI 2101 or for honors mathematics students: CSI 2110, (MAT 2141 or MAT 2143)",
      ),
    ).toEqual({
      type: "and_group",
      text: "CSI 2110, CSI 2101 or for honors mathematics students: CSI 2110, (MAT 2141 or MAT 2143)",
      children: [
        { type: "course", code: "CSI 2110", text: "CSI 2110" },
        {
          type: "or_group",
          text: "CSI 2101 or for honors mathematics students: CSI 2110",
          children: [
            { type: "course", code: "CSI 2101", text: "CSI 2101" },
            { type: "course", code: "CSI 2110", text: "for honors mathematics students: CSI 2110" },
          ],
        },
        {
          type: "or_group",
          text: "MAT 2141 or MAT 2143",
          children: [
            { type: "course", code: "MAT 2141", text: "MAT 2141" },
            { type: "course", code: "MAT 2143", text: "MAT 2143" },
          ],
        },
      ],
    });
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { messages } from "@uoplan/i18n/catalogs/en";
import { messages as frMessages } from "@uoplan/i18n/catalogs/fr-CA";
import { tr } from "../i18n";

beforeAll(() => {
  i18n.load("en", messages);
  i18n.load("fr-CA", frMessages);
  i18n.activate("en");
});

describe("prereqGraph semantic credit labels — ICU plural forms", () => {
  describe("EN: creditTotal", () => {
    it("singular: 1 credit", () => {
      expect(tr("prereqGraph.semantic.creditTotal", { credits: 1 })).toBe("1 credit");
    });
    it("plural: 6 credits", () => {
      expect(tr("prereqGraph.semantic.creditTotal", { credits: 6 })).toBe("6 credits");
    });
  });

  describe("EN: disciplineLevels", () => {
    it("singular: 1 credit in {description}", () => {
      expect(
        tr("prereqGraph.semantic.disciplineLevels", { credits: 1, description: "CSI 2000, 3000" }),
      ).toBe("1 credit in CSI 2000, 3000");
    });
    it("plural: 6 credits in {description}", () => {
      expect(
        tr("prereqGraph.semantic.disciplineLevels", { credits: 6, description: "CSI 2000, 3000" }),
      ).toBe("6 credits in CSI 2000, 3000");
    });
  });

  describe("EN: disciplines", () => {
    it("singular: 1 credit in {disciplines}", () => {
      expect(tr("prereqGraph.semantic.disciplines", { credits: 1, disciplines: "CSI" })).toBe(
        "1 credit in CSI",
      );
    });
    it("plural: 6 credits in {disciplines}", () => {
      expect(tr("prereqGraph.semantic.disciplines", { credits: 6, disciplines: "CSI, MAT" })).toBe(
        "6 credits in CSI, MAT",
      );
    });
  });

  describe("EN: levels", () => {
    it("singular: 1 credit at level {levels}", () => {
      expect(tr("prereqGraph.semantic.levels", { credits: 1, levels: "2000" })).toBe(
        "1 credit at level 2000",
      );
    });
    it("plural: 6 credits at level {levels}", () => {
      expect(tr("prereqGraph.semantic.levels", { credits: 6, levels: "2000, 3000" })).toBe(
        "6 credits at level 2000, 3000",
      );
    });
  });

  describe("FR-CA: creditTotal", () => {
    it("singular: 1 crédit", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.creditTotal", { credits: 1 })).toBe("1 crédit");
      i18n.activate("en");
    });
    it("plural: 6 crédits", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.creditTotal", { credits: 6 })).toBe("6 crédits");
      i18n.activate("en");
    });
  });

  describe("FR-CA: disciplines", () => {
    it("singular: 1 crédit en {disciplines}", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.disciplines", { credits: 1, disciplines: "CSI" })).toBe(
        "1 crédit en CSI",
      );
      i18n.activate("en");
    });
    it("plural: 6 crédits en {disciplines}", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.disciplines", { credits: 6, disciplines: "CSI, MAT" })).toBe(
        "6 crédits en CSI, MAT",
      );
      i18n.activate("en");
    });
  });

  describe("FR-CA: levels", () => {
    it("singular: 1 crédit au niveau {levels}", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.levels", { credits: 1, levels: "2000" })).toBe(
        "1 crédit au niveau 2000",
      );
      i18n.activate("en");
    });
    it("plural: 6 crédits au niveau {levels}", () => {
      i18n.activate("fr-CA");
      expect(tr("prereqGraph.semantic.levels", { credits: 6, levels: "2000, 3000" })).toBe(
        "6 crédits au niveau 2000, 3000",
      );
      i18n.activate("en");
    });
  });

  describe("FR-CA: disciplineLevels", () => {
    it("singular: 1 crédit en {description}", () => {
      i18n.activate("fr-CA");
      expect(
        tr("prereqGraph.semantic.disciplineLevels", { credits: 1, description: "CSI 2000, 3000" }),
      ).toBe("1 crédit en CSI 2000, 3000");
      i18n.activate("en");
    });
    it("plural: 6 crédits en {description}", () => {
      i18n.activate("fr-CA");
      expect(
        tr("prereqGraph.semantic.disciplineLevels", { credits: 6, description: "CSI 2000, 3000" }),
      ).toBe("6 crédits en CSI 2000, 3000");
      i18n.activate("en");
    });
  });
});

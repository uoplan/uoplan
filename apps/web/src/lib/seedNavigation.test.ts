import { describe, expect, it } from "vitest";
import {
  canGoToPreviousSeed,
  hasPersistedGeneratedSchedule,
  inferLowestVisitedSeedFromPersisted,
  nextSeed,
  noteLowestVisitedSeed,
  repairSeedPosition,
} from "./seedNavigation";

describe("seedNavigation", () => {
  const firstSeed = 1_000_000;

  describe("nextSeed", () => {
    it("anchors at firstSeed when currentSeed is 0", () => {
      expect(nextSeed(firstSeed, 0)).toBe(firstSeed);
    });

    it("increments when already on the ladder", () => {
      expect(nextSeed(firstSeed, firstSeed)).toBe(firstSeed + 1);
      expect(nextSeed(firstSeed, firstSeed + 5)).toBe(firstSeed + 6);
    });
  });

  describe("repairSeedPosition", () => {
    it("leaves 0 and valid ladder positions unchanged", () => {
      expect(repairSeedPosition(firstSeed, 0)).toBe(0);
      expect(repairSeedPosition(firstSeed, firstSeed)).toBe(firstSeed);
      expect(repairSeedPosition(firstSeed, firstSeed + 3)).toBe(firstSeed + 3);
    });

    it("resets orphan seeds below firstSeed to unset (0)", () => {
      expect(repairSeedPosition(firstSeed, 3)).toBe(0);
      expect(repairSeedPosition(firstSeed, firstSeed - 1)).toBe(0);
    });
  });

  describe("hasPersistedGeneratedSchedule", () => {
    it("is false before the first successful schedule seed is persisted", () => {
      expect(hasPersistedGeneratedSchedule(firstSeed, 0)).toBe(false);
    });

    it("is true when a generated schedule seed has been persisted", () => {
      expect(hasPersistedGeneratedSchedule(firstSeed, firstSeed)).toBe(true);
      expect(hasPersistedGeneratedSchedule(firstSeed, firstSeed + 2)).toBe(true);
    });

    it("ignores repaired orphan seed positions", () => {
      expect(hasPersistedGeneratedSchedule(firstSeed, firstSeed - 1)).toBe(false);
    });
  });

  describe("noteLowestVisitedSeed", () => {
    it("records first visit and keeps minimum", () => {
      expect(noteLowestVisitedSeed(null, firstSeed)).toBe(firstSeed);
      expect(noteLowestVisitedSeed(firstSeed, firstSeed + 3)).toBe(firstSeed);
    });
  });

  describe("inferLowestVisitedSeedFromPersisted", () => {
    it("returns null when unset", () => {
      expect(inferLowestVisitedSeedFromPersisted(firstSeed, 0)).toBe(null);
    });

    it("uses firstSeed as floor when current is past anchor", () => {
      expect(inferLowestVisitedSeedFromPersisted(firstSeed, firstSeed + 2)).toBe(firstSeed);
    });
  });

  describe("canGoToPreviousSeed", () => {
    it("is false after only one distinct seed has been visited", () => {
      expect(canGoToPreviousSeed(firstSeed, firstSeed)).toBe(false);
      expect(canGoToPreviousSeed(firstSeed + 1, firstSeed + 1)).toBe(false);
    });

    it("is true after visiting a second seed", () => {
      expect(canGoToPreviousSeed(firstSeed + 1, firstSeed)).toBe(true);
      expect(canGoToPreviousSeed(firstSeed + 2, firstSeed)).toBe(true);
    });

    it("is false when unset", () => {
      expect(canGoToPreviousSeed(0, null)).toBe(false);
    });
  });
});

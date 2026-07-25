import { describe, expect, it } from "vitest";

import { getRateMyProfessorsSchoolNodeId } from "./scrape.ts";

describe("getRateMyProfessorsSchoolNodeId", () => {
  it("keeps uOttawa as the default RateMyProfessors school", () => {
    expect(getRateMyProfessorsSchoolNodeId("uottawa")).toBe("U2Nob29sLTE0NTI=");
  });

  it("routes Carleton to its RateMyProfessors GraphQL node id", () => {
    expect(getRateMyProfessorsSchoolNodeId("carleton")).toBe("U2Nob29sLTE0MjA=");
  });
});

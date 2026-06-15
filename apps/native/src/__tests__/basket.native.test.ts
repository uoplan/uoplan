import { parseBasket, toggleCode } from "@/data/basket-storage";

describe("parseBasket", () => {
  it("parses a JSON array of codes", () => {
    expect(parseBasket('["ECO 2118","MAT 1320"]')).toEqual(["ECO 2118", "MAT 1320"]);
  });

  it("dedupes repeated codes preserving first order", () => {
    expect(parseBasket('["ECO 2118","ECO 2118","MAT 1320"]')).toEqual(["ECO 2118", "MAT 1320"]);
  });

  it("ignores non-string entries", () => {
    expect(parseBasket('["ECO 2118", 5, null, "MAT 1320"]')).toEqual(["ECO 2118", "MAT 1320"]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseBasket("not json")).toEqual([]);
  });

  it("returns [] for a non-array payload", () => {
    expect(parseBasket('{"a":1}')).toEqual([]);
  });
});

describe("toggleCode", () => {
  it("adds a code when absent (appended)", () => {
    expect(toggleCode(["ECO 2118"], "MAT 1320")).toEqual(["ECO 2118", "MAT 1320"]);
  });

  it("removes a code when present", () => {
    expect(toggleCode(["ECO 2118", "MAT 1320"], "ECO 2118")).toEqual(["MAT 1320"]);
  });

  it("does not mutate the input array", () => {
    const input = ["ECO 2118"];
    toggleCode(input, "MAT 1320");
    expect(input).toEqual(["ECO 2118"]);
  });
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

import { programOptionsFromEntries } from "@/app/(tabs)/personalize";

describe("personalize option derivation", () => {
  it("deduplicates programs by URL and labels every duplicate title", () => {
    const options = programOptionsFromEntries([
      { title: "Computer Science", url: "https://example.test/cs-a", slug: "cs-a" },
      { title: "Computer Science", url: "https://example.test/cs-a", slug: "cs-a" },
      { title: "Computer Science", url: "https://example.test/cs-b", slug: "cs-b" },
      { title: "Mathematics", url: "https://example.test/math", slug: "math" },
    ]);

    expect(options.map((option) => option.label)).toEqual([
      "Computer Science (1)",
      "Computer Science (2)",
      "Mathematics",
    ]);
    expect(options.map((option) => option.value)).toEqual([
      "https://example.test/cs-a",
      "https://example.test/cs-b",
      "https://example.test/math",
    ]);
  });
});

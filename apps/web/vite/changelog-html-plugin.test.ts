import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changelogHtmlPlugin } from "./changelog-html-plugin";

const resolvedVirtualId = "\0virtual:changelog-html";

describe("changelogHtmlPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses the rendered module for repeated changelog virtual loads", () => {
    const plugin = changelogHtmlPlugin();
    const load = plugin.load;
    if (typeof load !== "function") {
      throw new TypeError("Expected changelog plugin load hook to be a function");
    }

    const readSpy = vi.spyOn(fs, "readFileSync");
    const watchedFiles: string[] = [];
    const context = {
      addWatchFile(file: string) {
        watchedFiles.push(file);
      },
    } as unknown as ThisParameterType<typeof load>;

    const first = load.call(context, resolvedVirtualId);
    const second = load.call(context, resolvedVirtualId);

    expect(second).toBe(first);
    expect(
      readSpy.mock.calls.filter(([file]) => String(file).endsWith("CHANGELOG.md")),
    ).toHaveLength(1);
    expect(watchedFiles.some((file) => file.endsWith("CHANGELOG.md"))).toBe(true);
  });
});

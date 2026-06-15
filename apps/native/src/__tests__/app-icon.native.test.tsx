import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { ICON_PATHS } from "@/components/icon-paths.generated";

describe("AppIcon Android/web fallback", () => {
  const original = Platform.OS;
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  });
  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: original });
  });

  it("draws Tabler SVG paths for a mapped outline icon", async () => {
    const json = JSON.stringify((await render(<AppIcon name="magnifyingglass" />)).toJSON());
    expect(json).toContain("RNSVGPath");
    for (const d of ICON_PATHS.magnifyingglass.paths) {
      expect(json).toContain(d);
    }
  });

  it("draws the filled variant for a fill-based icon", async () => {
    expect(ICON_PATHS["heart.fill"].filled).toBe(true);
    const json = JSON.stringify((await render(<AppIcon name="heart.fill" />)).toJSON());
    for (const d of ICON_PATHS["heart.fill"].paths) {
      expect(json).toContain(d);
    }
  });

  it("falls back to a visible circle for an unmapped name", async () => {
    const json = JSON.stringify(
      (await render(<AppIcon name={"totally.unknown.symbol" as never} />)).toJSON(),
    );
    for (const d of ICON_PATHS.circle.paths) {
      expect(json).toContain(d);
    }
  });

  it("covers every used icon name with path data", () => {
    for (const entry of Object.values(ICON_PATHS)) {
      expect(entry.paths.length).toBeGreaterThan(0);
    }
  });
});

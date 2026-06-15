import { resolveAdaptiveLayout } from "./adaptive-layout";

describe("resolveAdaptiveLayout", () => {
  it("treats a portrait iPhone as a single-column compact phone", () => {
    const layout = resolveAdaptiveLayout(393, 852);
    expect(layout).toMatchObject({
      isTablet: false,
      isLandscape: false,
      orientation: "portrait",
      isCompactWidth: true,
      isRegularWidth: false,
      isWide: false,
      columns: 1,
      contentMaxWidth: 800,
      sidebar: false,
      formSheet: false,
    });
  });

  it("keeps a landscape iPhone compact (wide but short side stays a phone)", () => {
    const layout = resolveAdaptiveLayout(852, 393);
    expect(layout).toMatchObject({
      isTablet: false,
      isLandscape: true,
      orientation: "landscape",
      isCompactWidth: false,
      isRegularWidth: true,
      isWide: false,
      columns: 1,
      sidebar: false,
      formSheet: false,
    });
  });

  it("treats a narrow iPad (mini, portrait) as a tablet but keeps one column", () => {
    const layout = resolveAdaptiveLayout(744, 1133);
    expect(layout).toMatchObject({
      isTablet: true,
      isLandscape: false,
      orientation: "portrait",
      isCompactWidth: true,
      isRegularWidth: false,
      isWide: false,
      columns: 1,
      contentMaxWidth: 1100,
      sidebar: true,
      formSheet: true,
    });
  });

  it("uses two columns on a regular-width iPad in portrait", () => {
    const layout = resolveAdaptiveLayout(834, 1194);
    expect(layout).toMatchObject({
      isTablet: true,
      isLandscape: false,
      orientation: "portrait",
      isCompactWidth: false,
      isRegularWidth: true,
      isWide: false,
      columns: 2,
      sidebar: true,
      formSheet: true,
    });
  });

  it("uses two columns on an iPad in landscape", () => {
    const layout = resolveAdaptiveLayout(1194, 834);
    expect(layout).toMatchObject({
      isTablet: true,
      isLandscape: true,
      orientation: "landscape",
      isCompactWidth: false,
      isRegularWidth: true,
      isWide: true,
      columns: 2,
    });
  });
});

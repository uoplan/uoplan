import { resolveResponsiveColumnCount } from "@/components/layout/ResponsiveColumns";
import { resolveAdaptiveLayout } from "@/lib/adaptive-layout";

describe("ResponsiveColumns", () => {
  it("uses one column in compact width", () => {
    const layout = resolveAdaptiveLayout(393, 852);

    expect(resolveResponsiveColumnCount(layout)).toBe(1);
  });

  it("uses two columns in regular width", () => {
    const layout = resolveAdaptiveLayout(834, 1194);

    expect(resolveResponsiveColumnCount(layout)).toBe(2);
  });
});

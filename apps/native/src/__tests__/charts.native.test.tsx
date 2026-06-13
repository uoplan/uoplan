import { render } from "@testing-library/react-native";

import { AreaChart } from "@/components/area-chart";
import { BarChart } from "@/components/bar-chart";
import { ScatterChart } from "@/components/scatter-chart";

// Native react-native-svg analogues of the web @mantine/charts Bar/Scatter/Area
// charts. SvgText children aren't reachable via getByText, so we assert on the
// serialized host tree (RNSVG* nodes + label strings).
describe("native chart primitives", () => {
  const bars = [
    { label: "ITI", value: 6.5 },
    { label: "MAT", value: 5.8 },
    { label: "CSI", value: 7.4 },
  ];
  const points = [
    { x: 100, y: 6.5, label: "ITI" },
    { x: 320, y: 5.8, label: "MAT" },
    { x: 210, y: 7.4, label: "CSI" },
  ];

  it("BarChart renders bars + category labels", async () => {
    const view = await render(<BarChart width={320} data={bars} maxValue={10} />);
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("RNSVGRect");
    expect(json).toContain("ITI");
    expect(json).toContain("CSI");
  });

  it("ScatterChart renders points + axis labels", async () => {
    const view = await render(<ScatterChart width={320} data={points} yDomain={[4, 9]} />);
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("RNSVGCircle");
    expect(json).toContain("RNSVGSvgView");
  });

  it("AreaChart renders a filled area path", async () => {
    const view = await render(<AreaChart width={320} data={bars} />);
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("RNSVGPath");
    expect(json).toContain("ITI");
  });

  it("charts render without crashing on empty data", async () => {
    expect(await render(<BarChart width={320} data={[]} />)).toBeTruthy();
    expect(await render(<ScatterChart width={320} data={[]} />)).toBeTruthy();
    expect(await render(<AreaChart width={320} data={[]} />)).toBeTruthy();
  });
});

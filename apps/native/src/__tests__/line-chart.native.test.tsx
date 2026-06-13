import { render } from "@testing-library/react-native";

import { LineChart } from "@/components/line-chart";

// The native LineChart is the react-native-svg analogue of the web
// @mantine/charts LineChart. It renders y-tick + x-category labels and the
// value line; here we assert it mounts and surfaces the axis labels.
describe("LineChart (native)", () => {
  const data = [
    { label: "F22", value: 6.8 },
    { label: "W23", value: 6.5 },
    { label: "F23", value: 7.0 },
  ];

  async function renderChart(props: Parameters<typeof LineChart>[0]) {
    return render(<LineChart width={320} {...props} />);
  }

  it("renders the svg chart with axis labels", async () => {
    const view = await renderChart({ data });
    // react-native-svg renders host nodes (RNSVGSvgView/RNSVGText); SvgText
    // children aren't reachable via getByText, so assert on the serialized tree.
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("RNSVGSvgView");
    expect(json).toContain("F22");
    expect(json).toContain("F23");
  });

  it("renders without crashing on empty data", async () => {
    const view = await renderChart({ data: [] });
    expect(view).toBeTruthy();
  });
});

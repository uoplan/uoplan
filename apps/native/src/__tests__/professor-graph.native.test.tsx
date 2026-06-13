import { render } from "@testing-library/react-native";

import { ProfessorGraph } from "@/components/professor-graph";
import { SAMPLE_GRAPH_EDGES, SAMPLE_GRAPH_NODES, graphGroupColor } from "@/data/sample-graph";

// Native react-native-svg professor network (analogue of the web Sigma graph).
// SvgText/Circle/Line children aren't reachable via getByText, so we assert on
// the serialized host tree (RNSVG* nodes) + the selected node's label string.
describe("ProfessorGraph", () => {
  it("renders edges and nodes as SVG primitives", async () => {
    const view = await render(
      <ProfessorGraph
        width={320}
        nodes={SAMPLE_GRAPH_NODES}
        edges={SAMPLE_GRAPH_EDGES}
        colorFor={graphGroupColor}
      />,
    );
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("RNSVGSvgView");
    expect(json).toContain("RNSVGCircle");
    expect(json).toContain("RNSVGLine");
  });

  it("renders a label for the selected node", async () => {
    const view = await render(
      <ProfessorGraph
        width={320}
        nodes={SAMPLE_GRAPH_NODES}
        edges={SAMPLE_GRAPH_EDGES}
        colorFor={graphGroupColor}
        selectedId="mat-a"
      />,
    );
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain("Dr. Bélanger");
  });
});

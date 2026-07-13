import { page, userEvent } from "vitest/browser";
import { describe, expect, test } from "vitest";
import { RouterProvider } from "@tanstack/react-router";
import type {
  NormalizedCourseCode,
  PrereqGraph,
  PrereqGraphAggregateNode,
  PrereqGraphCourseNode,
  PrereqGraphEdge,
  PrereqGraphGateNode,
  PrereqGraphSemanticNode,
} from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { tr } from "../../i18n";
import { renderWithProviders } from "../../test/renderWithProviders";
import { createTestRouter } from "../../test/testRouter";
import { CoursePrereqGraph } from "./CoursePrereqGraph";

// ---------------------------------------------------------------------------
// Test fixtures: hand-built graphs
// ---------------------------------------------------------------------------

function makeCourseNode(
  overrides: Partial<PrereqGraphCourseNode> & { id: string; code: NormalizedCourseCode },
): PrereqGraphCourseNode {
  return {
    kind: "course",
    role: "prerequisite",
    resolvable: true,
    status: "unknown",
    rank: 0,
    lane: 0,
    ...overrides,
  } as PrereqGraphCourseNode;
}

function makeEdge(
  sourceId: string,
  targetId: string,
  status: "met" | "missing" | "unknown" = "unknown",
): PrereqGraphEdge {
  return { id: `${sourceId}->${targetId}`, sourceId, targetId, status };
}

/** Simple graph: CSI 2101 (prereq, met) → CSI 3105 (target) */
const SIMPLE_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    makeCourseNode({
      id: "prereq-1",
      code: normalizeCourseCode("CSI 2101"),
      rank: 0,
      lane: 0,
      status: "met",
      programLabel: "Programs: CEG",
    }),
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("CSI 3105"),
      rank: 1,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [makeEdge("prereq-1", "target", "met")],
  rankCount: 2,
  laneCount: 1,
  a11yDescription: "Prerequisites for CSI 3105: CSI 2101 (met)",
};

/** Graph with all 3 statuses */
const STATUS_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    makeCourseNode({
      id: "met-node",
      code: normalizeCourseCode("MAT 1320"),
      rank: 0,
      lane: 0,
      status: "met",
    }),
    makeCourseNode({
      id: "missing-node",
      code: normalizeCourseCode("MAT 1322"),
      rank: 0,
      lane: 1,
      status: "missing",
    }),
    makeCourseNode({
      id: "unknown-node",
      code: normalizeCourseCode("MAT 2122"),
      rank: 0,
      lane: 2,
      status: "unknown",
    }),
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("MAT 3121"),
      rank: 1,
      lane: 1,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [
    makeEdge("met-node", "target", "met"),
    makeEdge("missing-node", "target", "missing"),
    makeEdge("unknown-node", "target", "unknown"),
  ],
  rankCount: 2,
  laneCount: 3,
  a11yDescription: "Prerequisites for MAT 3121",
};

/** Wide graph that should cause internal horizontal scrolling */
const WIDE_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    makeCourseNode({
      id: "n0",
      code: normalizeCourseCode("CSI 1100"),
      rank: 0,
      lane: 0,
      status: "met",
    }),
    makeCourseNode({
      id: "n1",
      code: normalizeCourseCode("CSI 2100"),
      rank: 1,
      lane: 0,
      status: "met",
    }),
    makeCourseNode({
      id: "n2",
      code: normalizeCourseCode("CSI 2101"),
      rank: 2,
      lane: 0,
      status: "missing",
    }),
    makeCourseNode({
      id: "n3",
      code: normalizeCourseCode("CSI 3100"),
      rank: 3,
      lane: 0,
      status: "unknown",
    }),
    makeCourseNode({
      id: "n4",
      code: normalizeCourseCode("CSI 3101"),
      rank: 4,
      lane: 0,
      status: "unknown",
    }),
    makeCourseNode({
      id: "n5",
      code: normalizeCourseCode("CSI 4100"),
      rank: 5,
      lane: 0,
      status: "unknown",
    }),
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("CSI 4900"),
      rank: 6,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [
    makeEdge("n0", "n1", "met"),
    makeEdge("n1", "n2", "met"),
    makeEdge("n2", "n3", "missing"),
    makeEdge("n3", "n4", "unknown"),
    makeEdge("n4", "n5", "unknown"),
    makeEdge("n5", "target", "unknown"),
  ],
  rankCount: 7,
  laneCount: 1,
  a11yDescription: "Prerequisites for CSI 4900: long chain",
};

/** Graph with aggregate node */
const AGGREGATE_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    {
      id: "agg-1",
      kind: "aggregate",
      mode: "any",
      label: "5 of",
      status: "missing",
      rank: 0,
      lane: 0,
      children: [
        {
          kind: "course",
          code: normalizeCourseCode("CSI 2101"),
          status: "met",
          resolvable: true,
        },
        {
          kind: "course",
          code: normalizeCourseCode("CSI 2110"),
          status: "missing",
          resolvable: true,
        },
        {
          kind: "course",
          code: normalizeCourseCode("CSI 2120"),
          status: "unknown",
          resolvable: false,
        },
      ],
    } as PrereqGraphAggregateNode,
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("CSI 4900"),
      rank: 1,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [makeEdge("agg-1", "target", "missing")],
  rankCount: 2,
  laneCount: 1,
  a11yDescription: "Prerequisites for CSI 4900 with aggregate",
};

/** Graph with semantic disclosure node */
const SEMANTIC_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    {
      id: "sem-1",
      kind: "semantic",
      label: "9 MAT credits",
      status: "met",
      rank: 0,
      lane: 0,
      disclosureText: "9 credits in mathematics at the 2000 level or above",
    } as PrereqGraphSemanticNode,
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("MAT 4100"),
      rank: 1,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [makeEdge("sem-1", "target", "met")],
  rankCount: 2,
  laneCount: 1,
  a11yDescription: "Prerequisites for MAT 4100: 9 MAT credits",
};

/** Graph with unresolvable course node */
const UNRESOLVABLE_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    makeCourseNode({
      id: "unres-1",
      code: normalizeCourseCode("UNKNOWN1"),
      rank: 0,
      lane: 0,
      status: "unknown",
      resolvable: false,
    }),
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("CSI 3105"),
      rank: 1,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [makeEdge("unres-1", "target", "unknown")],
  rankCount: 2,
  laneCount: 1,
  a11yDescription: "Prerequisites for CSI 3105",
};

/** Graph with gate nodes */
const GATE_GRAPH: PrereqGraph = {
  rootId: "target",
  nodes: [
    makeCourseNode({
      id: "c1",
      code: normalizeCourseCode("CSI 2101"),
      rank: 0,
      lane: 0,
      status: "met",
    }),
    makeCourseNode({
      id: "c2",
      code: normalizeCourseCode("CSI 2110"),
      rank: 0,
      lane: 1,
      status: "missing",
    }),
    {
      id: "and-gate",
      kind: "and_gate",
      label: "AND",
      status: "missing",
      rank: 1,
      lane: 0,
    } as PrereqGraphGateNode,
    makeCourseNode({
      id: "target",
      code: normalizeCourseCode("CSI 3105"),
      rank: 2,
      lane: 0,
      role: "target",
      status: "unknown",
    }),
  ],
  edges: [
    makeEdge("c1", "and-gate", "met"),
    makeEdge("c2", "and-gate", "missing"),
    makeEdge("and-gate", "target", "missing"),
  ],
  rankCount: 3,
  laneCount: 2,
  a11yDescription: "Prerequisites for CSI 3105: CSI 2101 AND CSI 2110",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoursePrereqGraph", () => {
  test("course link has correct href preserving search params", async () => {
    const linkSearch = {
      q: "test",
      levels: undefined,
      langs: undefined,
      disc: undefined,
      difficulty: undefined,
      rating: undefined,
      feedback: undefined,
      delivery: undefined,
      term: undefined,
      reqs: undefined,
      sort: undefined,
      dir: undefined,
    };
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: {
        "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} linkSearch={linkSearch} />,
        "/explore/course/$course": <div>COURSE PAGE</div>,
      },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const link = page.getByRole("link", { name: /CSI 2101/ });
    await expect.element(link).toBeInTheDocument();
    await expect.element(page.getByText("Programs: CEG")).toBeInTheDocument();
    // Link should point to the correct course path with search params
    await expect
      .element(link)
      .toHaveAttribute("href", expect.stringContaining("/explore/course/csi2101"));
    await expect.element(link).toHaveAttribute("href", expect.stringContaining("q=test"));
  });

  test("target node is visually distinct and shows code only", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const target = page.getByTestId("prereq-target");
    await expect.element(target).toBeInTheDocument();
    await expect.element(target).toHaveTextContent("CSI 3105");
    // Target is not a link (non-navigating)
    const targetEl = target.element();
    expect(targetEl.tagName.toLowerCase()).not.toBe("a");
  });

  test("simple graphs use the same fixed viewport height as larger graphs", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    expect(page.getByTestId("prereq-graph").element().getBoundingClientRect().height).toBe(156);
  });

  test("centers a short graph canvas within the fixed viewport", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const viewportBounds = page.getByTestId("prereq-graph").element().getBoundingClientRect();
    const canvasBounds = page
      .getByTestId("prereq-graph")
      .element()
      .firstElementChild!.getBoundingClientRect();
    expect(canvasBounds.top + canvasBounds.height / 2).toBe(
      viewportBounds.top + viewportBounds.height / 2,
    );
  });

  test("all statuses have non-color accessible cues (icon + title)", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={STATUS_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    // Met node has checkmark and translated title
    const metNode = page.getByRole("link", { name: /MAT 1320/ });
    await expect.element(metNode).toHaveAttribute("title", tr("prereqGraph.status.met"));
    await expect.element(metNode).toHaveTextContent("✓");

    // Missing node has cross and translated title
    const missingNode = page.getByRole("link", { name: /MAT 1322/ });
    await expect.element(missingNode).toHaveAttribute("title", tr("prereqGraph.status.missing"));
    await expect.element(missingNode).toHaveTextContent("✗");

    // Unknown node has question mark and translated title
    const unknownNode = page.getByRole("link", { name: /MAT 2122/ });
    await expect.element(unknownNode).toHaveAttribute("title", tr("prereqGraph.status.unknown"));
    await expect.element(unknownNode).toHaveTextContent("?");

    const graphBounds = page.getByTestId("prereq-graph").element().getBoundingClientRect();
    const lowestNodeBounds = unknownNode.element().getBoundingClientRect();
    expect(graphBounds.height).toBe(156);
    expect(lowestNodeBounds.bottom).toBeLessThanOrEqual(graphBounds.bottom);
  });

  test("wide graph pans by dragging without scrollbars or an edge fade", async () => {
    await page.viewport(400, 600);

    const router = createTestRouter({
      initialEntries: ["/"],
      routes: {
        "/": (
          <div style={{ width: 400, overflow: "hidden" }}>
            <CoursePrereqGraph graph={WIDE_GRAPH} />
          </div>
        ),
      },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const graphEl = page.getByTestId("prereq-graph");
    await expect.element(graphEl).toBeInTheDocument();

    const el = graphEl.element();
    const computedStyle = window.getComputedStyle(el);
    expect(computedStyle.overflowX).toBe("clip");
    expect(computedStyle.maskImage).toBe("none");
    expect(el.scrollWidth).toBeGreaterThan(el.clientWidth);
    expect(document.body.scrollWidth).toBeLessThanOrEqual(document.body.clientWidth + 1);

    const canvas = el.firstElementChild as HTMLElement;
    const initialLeft = canvas.getBoundingClientRect().left;
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 300,
        clientY: 50,
        pointerId: 1,
      }),
    );
    el.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 180,
        clientY: 50,
        pointerId: 1,
      }),
    );
    el.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 180,
        clientY: 50,
        pointerId: 1,
      }),
    );

    await expect.poll(() => canvas.getBoundingClientRect().left).toBeLessThan(initialLeft);
  });

  test("uses the evaluation-card chrome, dotted canvas, and padded nodes", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const graph = page.getByTestId("prereq-graph").element();
    const node = page.getByRole("link", { name: /CSI 2101/ }).element();
    const graphStyle = window.getComputedStyle(graph);
    const nodeStyle = window.getComputedStyle(node);

    expect(graphStyle.borderTopWidth).toBe("1px");
    expect(graphStyle.borderRadius).toBe("12px");
    expect(graphStyle.backgroundImage).toContain("radial-gradient");
    expect(Number.parseFloat(nodeStyle.paddingInlineStart)).toBeGreaterThan(0);
    expect(Number.parseFloat(nodeStyle.paddingBlockStart)).toBeGreaterThan(0);
  });

  test("aggregate node opens popover with child course links", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: {
        "/": <CoursePrereqGraph graph={AGGREGATE_GRAPH} />,
        "/explore/course/$course": <div>COURSE PAGE</div>,
      },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const aggButton = page.getByTestId("prereq-aggregate");
    await expect.element(aggButton).toBeInTheDocument();
    await expect.element(aggButton).toHaveAttribute("aria-expanded", "false");

    // Click to open
    await aggButton.click();
    await expect.element(aggButton).toHaveAttribute("aria-expanded", "true");

    // Child links should appear in the popover
    const childLink = page.getByRole("link", { name: /CSI 2101/ });
    await expect.element(childLink).toBeInTheDocument();

    // Resolvable child link should have correct href
    await expect
      .element(childLink)
      .toHaveAttribute("href", expect.stringContaining("/explore/course/csi2101"));

    // Non-resolvable child should not be a link
    const nonResolvable = page.getByText("CSI 2120");
    await expect.element(nonResolvable).toBeInTheDocument();
    const nonResEl = nonResolvable.element();
    expect(nonResEl.tagName.toLowerCase()).not.toBe("a");
  });

  test("semantic disclosure node opens text popover", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SEMANTIC_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const semButton = page.getByTestId("prereq-semantic-disclosure");
    await expect.element(semButton).toBeInTheDocument();
    await expect.element(semButton).toHaveTextContent("9 MAT credits");
    await expect.element(semButton).toHaveAttribute("aria-expanded", "false");

    // Click to open disclosure
    await semButton.click();
    await expect.element(semButton).toHaveAttribute("aria-expanded", "true");

    // Full disclosure text should appear
    await expect
      .element(page.getByText("9 credits in mathematics at the 2000 level or above"))
      .toBeInTheDocument();
  });

  test("graph wrapper exposes a11y description", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SIMPLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const graphEl = page.getByTestId("prereq-graph");
    await expect
      .element(graphEl)
      .toHaveAttribute("aria-label", "Prerequisites for CSI 3105: CSI 2101 (met)");
    // Rendered as a <figure> for semantic grouping
    expect(graphEl.element().tagName.toLowerCase()).toBe("figure");
  });

  test("keyboard activation opens aggregate disclosure", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: {
        "/": <CoursePrereqGraph graph={AGGREGATE_GRAPH} />,
        "/explore/course/$course": <div>COURSE PAGE</div>,
      },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const aggButton = page.getByTestId("prereq-aggregate");
    await expect.element(aggButton).toBeInTheDocument();

    // Focus and press Enter
    aggButton.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(aggButton).toHaveAttribute("aria-expanded", "true");
  });

  test("keyboard activation opens semantic disclosure", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={SEMANTIC_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    const semButton = page.getByTestId("prereq-semantic-disclosure");
    semButton.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(semButton).toHaveAttribute("aria-expanded", "true");
  });

  test("unresolvable prerequisite node is not a link", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={UNRESOLVABLE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    // The unresolvable node should display the code but not be a link
    const nodeEl = page.getByText("UNKNOWN1");
    await expect.element(nodeEl).toBeInTheDocument();
    // Should not be a link tag
    const el = nodeEl.element();
    // Walk up to find the positioned node container
    const container = el.closest("[class*='node']") ?? el;
    expect(container.tagName.toLowerCase()).not.toBe("a");
  });

  test("AND/OR gates are aria-hidden", async () => {
    const router = createTestRouter({
      initialEntries: ["/"],
      routes: { "/": <CoursePrereqGraph graph={GATE_GRAPH} /> },
    });

    await renderWithProviders(<RouterProvider router={router} />);

    // Gate should render with AND text
    const andGate = page.getByText("AND");
    await expect.element(andGate).toBeInTheDocument();
    // Gate is aria-hidden
    await expect.element(andGate).toHaveAttribute("aria-hidden", "true");
  });
});

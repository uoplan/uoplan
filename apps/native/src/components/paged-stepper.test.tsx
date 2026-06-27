import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Animated, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PagedStepper } from "@/components/paged-stepper";
import { RequirementsStep } from "@/components/personalize/requirements-step";
import { StepDots } from "@/components/step-dots";
import { Surface } from "@/constants/theme";
import {
  DEFAULT_REQUIREMENT_SELECTIONS,
  type PersonalizeRequirementsReadout,
} from "@/lib/personalize-requirements";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderWithSafeArea(element: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={initialMetrics}>{element}</SafeAreaProvider>);
}

const incompleteReadout: PersonalizeRequirementsReadout = {
  programTitle: "Test program",
  remainingCount: 1,
  unassignedCompletedCourses: ["ENG 1100"],
  remaining: [
    {
      requirementId: "elective-1",
      type: "discipline_elective",
      title: "3 optional course units in English (ENG)",
      candidateCourses: ["ENG 1100"],
      creditsNeeded: 3,
      satisfiedBy: [],
    },
  ],
  completed: [],
};

const completeReadout: PersonalizeRequirementsReadout = {
  programTitle: "Test program",
  remainingCount: 0,
  unassignedCompletedCourses: [],
  remaining: [],
  completed: [],
};

function styleList(style: unknown): unknown[] {
  if (Array.isArray(style)) return style.flatMap(styleList);
  return style == null ? [] : [style];
}

interface JsonNode {
  props?: { testID?: string; style?: unknown };
  children?: (JsonNode | string)[];
}

function findJsonByTestId(node: JsonNode | string | null, testID: string): JsonNode | null {
  if (!node || typeof node === "string") return null;
  if (node.props?.testID === testID) return node;
  for (const child of node.children ?? []) {
    const match = findJsonByTestId(child, testID);
    if (match) return match;
  }
  return null;
}

function hasDotShape(style: unknown): style is { width?: unknown; backgroundColor?: unknown } {
  return (
    typeof style === "object" && style !== null && "width" in style && "backgroundColor" in style
  );
}

describe("PagedStepper", () => {
  it("shows the active step and marks the first dot selected", async () => {
    const { getByText, queryByText, getByTestId } = await renderWithSafeArea(
      <PagedStepper
        steps={[
          { key: "term", title: "Term", content: <Text>Choose a term</Text> },
          { key: "transcript", title: "Transcript", content: <Text>Upload transcript</Text> },
        ]}
      />,
    );

    // Only the active page is exposed (off-screen pages are hidden from a11y).
    expect(getByText("Term")).toBeTruthy();
    expect(queryByText("Transcript")).toBeNull();
    expect(getByTestId("step-dot-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId("step-dot-1").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("jumps to a step when its dot is pressed", async () => {
    const onIndexChange = jest.fn();
    const { getByText, queryByText, getByTestId } = await renderWithSafeArea(
      <PagedStepper
        onIndexChange={onIndexChange}
        steps={[
          { key: "term", title: "Term", content: <Text>Choose a term</Text> },
          { key: "requirements", title: "Requirements", content: <Text>Fill requirements</Text> },
        ]}
      />,
    );

    await fireEvent.press(getByTestId("step-dot-1"));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(getByText("Requirements")).toBeTruthy();
    expect(queryByText("Term")).toBeNull();
    expect(getByTestId("step-dot-1").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId("step-dot-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("keeps the bottom bar dedicated to step dots", async () => {
    const onPrimary = jest.fn();
    const { getByTestId, queryByLabelText } = await renderWithSafeArea(
      <PagedStepper
        primaryLabel="Show me my schedule"
        onPrimary={onPrimary}
        steps={[
          { key: "term", title: "Term", content: <Text>Choose a term</Text> },
          { key: "requirements", title: "Requirements", content: <Text>Fill requirements</Text> },
        ]}
      />,
    );

    expect(queryByLabelText("Show me my schedule")).toBeNull();

    await fireEvent.press(getByTestId("step-dot-1"));

    expect(queryByLabelText("Show me my schedule")).toBeNull();
    expect(onPrimary).not.toHaveBeenCalled();
  });
});

describe("StepDots", () => {
  it("drives active width and tint from swipe progress", async () => {
    const scrollX = new Animated.Value(50);
    const { toJSON } = await render(
      <StepDots count={2} activeIndex={0} scrollX={scrollX} pageWidth={100} />,
    );

    const pressable = findJsonByTestId(toJSON() as JsonNode, "step-dot-0");
    const dot = pressable?.children?.find((child) => typeof child !== "string") as
      | JsonNode
      | undefined;
    expect(dot).toBeTruthy();
    if (!dot) throw new Error("Expected step dot visual node");
    expect(dot.props).toBeTruthy();
    if (!dot.props) throw new Error("Expected step dot props");
    const styles = styleList(dot.props.style);

    const visualStyle = styles.find(hasDotShape);
    expect(visualStyle).toBeTruthy();
    expect(visualStyle?.width).not.toBe(18);
    expect(visualStyle?.backgroundColor).not.toBe(Surface.accent);
  });
});

describe("RequirementsStep CTA", () => {
  it("anchors a disabled generate button until requirements are filled", async () => {
    const onGenerate = jest.fn();
    const { getByLabelText } = await renderWithSafeArea(
      <RequirementsStep
        program="program-url"
        readout={incompleteReadout}
        selections={DEFAULT_REQUIREMENT_SELECTIONS}
        titleForCourse={() => "Eligible course"}
        onChange={jest.fn()}
        generateLabel="Show me my schedule"
        canGenerate={false}
        onGenerate={onGenerate}
      />,
    );

    const cta = getByLabelText("Show me my schedule");
    expect(cta.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.press(cta);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("enables the generate button once all requirements are met", async () => {
    const onGenerate = jest.fn();
    const { getByLabelText } = await renderWithSafeArea(
      <RequirementsStep
        program="program-url"
        readout={completeReadout}
        selections={DEFAULT_REQUIREMENT_SELECTIONS}
        titleForCourse={() => "Eligible course"}
        onChange={jest.fn()}
        generateLabel="Show me my schedule"
        canGenerate
        onGenerate={onGenerate}
      />,
    );

    const cta = getByLabelText("Show me my schedule");
    expect(cta.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));

    await fireEvent.press(cta);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

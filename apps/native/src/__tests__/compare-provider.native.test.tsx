import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { MAX_COMPARE_ITEMS, type CompareRef } from "@uoplan/core";

import { CompareProvider, useCompare } from "@/data/compare-provider";

const mockCapture = jest.fn();

jest.mock("@/lib/analytics/client", () => ({
  getAnalytics: () => ({ capture: mockCapture }),
}));

const COURSE_A: CompareRef = { kind: "course", id: "AAA 1000" };
const COURSE_B: CompareRef = { kind: "course", id: "BBB 2000" };
const COURSE_C: CompareRef = { kind: "course", id: "CCC 3000" };
const COURSE_D: CompareRef = { kind: "course", id: "DDD 4000" };
const COURSE_E: CompareRef = { kind: "course", id: "EEE 5000" };
const PROFESSOR: CompareRef = { kind: "professor", id: "ada-lovelace" };

function CompareProbe() {
  const compare = useCompare();
  return (
    <>
      <Text testID="count">{compare.count}</Text>
      <Text testID="refs">{compare.refs.map((ref) => `${ref.kind}:${ref.id}`).join("|")}</Text>
      <Text testID="has-a">{compare.has(COURSE_A) ? "yes" : "no"}</Text>
      <Pressable testID="toggle-a" onPress={() => compare.toggle(COURSE_A)}>
        <Text>toggle-a</Text>
      </Pressable>
      <Pressable testID="add-b" onPress={() => compare.add(COURSE_B)}>
        <Text>add-b</Text>
      </Pressable>
      <Pressable testID="add-c" onPress={() => compare.add(COURSE_C)}>
        <Text>add-c</Text>
      </Pressable>
      <Pressable testID="add-d" onPress={() => compare.add(COURSE_D)}>
        <Text>add-d</Text>
      </Pressable>
      <Pressable testID="add-e" onPress={() => compare.add(COURSE_E)}>
        <Text>add-e</Text>
      </Pressable>
      <Pressable testID="add-professor" onPress={() => compare.add(PROFESSOR)}>
        <Text>add-professor</Text>
      </Pressable>
      <Pressable testID="clear" onPress={() => compare.clear()}>
        <Text>clear</Text>
      </Pressable>
    </>
  );
}

function renderProbe() {
  return render(
    <CompareProvider>
      <CompareProbe />
    </CompareProvider>,
  );
}

describe("CompareProvider", () => {
  beforeEach(() => {
    mockCapture.mockClear();
  });

  it("keeps compare refs transient in memory and emits add/remove analytics with the next count", async () => {
    const { getByTestId } = await renderProbe();

    expect(getByTestId("count").props.children).toBe(0);
    expect(getByTestId("refs").props.children).toBe("");
    expect(getByTestId("has-a").props.children).toBe("no");

    await fireEvent.press(getByTestId("toggle-a"));

    expect(getByTestId("count").props.children).toBe(1);
    expect(getByTestId("refs").props.children).toBe("course:AAA 1000");
    expect(getByTestId("has-a").props.children).toBe("yes");
    expect(mockCapture).toHaveBeenLastCalledWith("compare_added", {
      kind: "course",
      id: "AAA 1000",
      count: 1,
    });

    await fireEvent.press(getByTestId("toggle-a"));

    expect(getByTestId("count").props.children).toBe(0);
    expect(getByTestId("refs").props.children).toBe("");
    expect(getByTestId("has-a").props.children).toBe("no");
    expect(mockCapture).toHaveBeenLastCalledWith("compare_removed", {
      kind: "course",
      id: "AAA 1000",
      count: 0,
    });
  });

  it("delegates homogeneous reset and max-size capping to the shared compare reducers", async () => {
    const { getByTestId } = await renderProbe();

    for (const testID of ["toggle-a", "add-b", "add-c", "add-d", "add-e"]) {
      await fireEvent.press(getByTestId(testID));
    }

    expect(getByTestId("count").props.children).toBe(MAX_COMPARE_ITEMS);
    expect(getByTestId("refs").props.children).toBe(
      "course:AAA 1000|course:BBB 2000|course:CCC 3000|course:DDD 4000",
    );

    await fireEvent.press(getByTestId("add-professor"));

    expect(getByTestId("count").props.children).toBe(1);
    expect(getByTestId("refs").props.children).toBe("professor:ada-lovelace");

    await fireEvent.press(getByTestId("clear"));

    expect(getByTestId("count").props.children).toBe(0);
    expect(getByTestId("refs").props.children).toBe("");
  });
});

import { useState } from "react";

import { fireEvent, render } from "@testing-library/react-native";

import { Button, Drawer, Menu, MultiSelect, Popover, Select, Text, Tooltip } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the overlay/select-tier
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors the
// web browser overlay contract test in apps/web. Native overlays use RN Modal,
// which only renders children when visible, so each test opens the overlay first.

function ControlledPopover() {
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      target={<Button onPress={() => setOpened((o) => !o)}>Open popover</Button>}
    >
      <Text>POPOVER BODY</Text>
    </Popover>
  );
}

function ControlledDrawer() {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button onPress={() => setOpened(true)}>Open drawer</Button>
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Panel">
        <Text>DRAWER BODY</Text>
      </Drawer>
    </>
  );
}

describe("@uoplan/ui overlay/select-tier primitives (native variants)", () => {
  it("Tooltip renders its target passthrough", async () => {
    const { getByText } = await render(
      <Tooltip label="Helpful hint">
        <Text>Tooltip target</Text>
      </Tooltip>,
    );
    expect(getByText("Tooltip target")).toBeTruthy();
  });

  it("Popover opens its dropdown when the target is pressed", async () => {
    const { getByText, queryByText } = await render(<ControlledPopover />);
    expect(queryByText("POPOVER BODY")).toBeNull();
    await fireEvent.press(getByText("Open popover"));
    expect(getByText("POPOVER BODY")).toBeTruthy();
  });

  it("Menu opens and fires onSelect for the chosen item", async () => {
    const onSelect = jest.fn();
    const { getByText, queryByText } = await render(
      <Menu
        target={<Text>Open menu</Text>}
        items={[
          { value: "a", label: "Action A", onSelect },
          { value: "b", label: "Action B", onSelect: () => {} },
        ]}
      />,
    );
    expect(queryByText("Action A")).toBeNull();
    await fireEvent.press(getByText("Open menu"));
    await fireEvent.press(getByText("Action A"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Select opens and reports the chosen value", async () => {
    const onChange = jest.fn();
    const { getByText } = await render(
      <Select
        onChange={onChange}
        placeholder="Pick one"
        data={[
          { value: "x", label: "Option X" },
          { value: "y", label: "Option Y" },
        ]}
      />,
    );
    await fireEvent.press(getByText("Pick one"));
    await fireEvent.press(getByText("Option Y"));
    expect(onChange).toHaveBeenCalledWith("y");
  });

  it("MultiSelect opens and accumulates the chosen values", async () => {
    const onChange = jest.fn();
    const { getByText } = await render(
      <MultiSelect
        value={[]}
        onChange={onChange}
        placeholder="Pick many"
        data={[
          { value: "x", label: "Choice X" },
          { value: "y", label: "Choice Y" },
        ]}
      />,
    );
    await fireEvent.press(getByText("Pick many"));
    await fireEvent.press(getByText("Choice X"));
    expect(onChange).toHaveBeenCalledWith(["x"]);
  });

  it("Drawer reveals its content when opened", async () => {
    const { getByText, queryByText } = await render(<ControlledDrawer />);
    expect(queryByText("DRAWER BODY")).toBeNull();
    await fireEvent.press(getByText("Open drawer"));
    expect(getByText("DRAWER BODY")).toBeTruthy();
  });
});

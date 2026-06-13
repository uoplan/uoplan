import { render } from "@testing-library/react-native";

import { Container, Flex, ScrollArea, SimpleGrid, Space, Text } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the secondary layout
// primitives (Container/Space/Flex/SimpleGrid/ScrollArea) and RNTL mounts them.
// Mirrors the web browser contract test in apps/web.
describe("@uoplan/ui layout-2 primitives (native variants)", () => {
  it("Container renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Container testID="contract-container" maxWidth={640} px="md">
        <Text>container content</Text>
      </Container>,
    );
    expect(getByTestId("contract-container")).toBeTruthy();
    expect(getByText("container content")).toBeTruthy();
  });

  it("Space renders an empty spacer", async () => {
    const { getByTestId } = await render(<Space testID="contract-space" h="md" />);
    expect(getByTestId("contract-space")).toBeTruthy();
  });

  it("Flex renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Flex testID="contract-flex" direction="column" gap="sm" align="center">
        <Text>a</Text>
        <Text>b</Text>
      </Flex>,
    );
    expect(getByTestId("contract-flex")).toBeTruthy();
    expect(getByText("a")).toBeTruthy();
    expect(getByText("b")).toBeTruthy();
  });

  it("SimpleGrid renders its children in cells", async () => {
    const { getByTestId, getByText } = await render(
      <SimpleGrid testID="contract-grid" cols={2} spacing="md">
        <Text>a</Text>
        <Text>b</Text>
      </SimpleGrid>,
    );
    expect(getByTestId("contract-grid")).toBeTruthy();
    expect(getByText("a")).toBeTruthy();
    expect(getByText("b")).toBeTruthy();
  });

  it("ScrollArea renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <ScrollArea testID="contract-scroll">
        <Text>scrollable</Text>
      </ScrollArea>,
    );
    expect(getByTestId("contract-scroll")).toBeTruthy();
    expect(getByText("scrollable")).toBeTruthy();
  });
});

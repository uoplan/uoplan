import { render } from "@testing-library/react-native";

import { Box, Group, Stack, Text, Title } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the layout/typography
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser contract test in apps/web.
describe("@uoplan/ui layout primitives (native variants)", () => {
  it("Box renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Box testID="contract-box" p="md">
        <Text>box content</Text>
      </Box>,
    );
    expect(getByTestId("contract-box")).toBeTruthy();
    expect(getByText("box content")).toBeTruthy();
  });

  it("Stack renders its children", async () => {
    const { getByTestId } = await render(
      <Stack testID="contract-stack" gap="sm">
        <Text>a</Text>
        <Text>b</Text>
      </Stack>,
    );
    expect(getByTestId("contract-stack")).toBeTruthy();
  });

  it("Group renders its children", async () => {
    const { getByTestId } = await render(
      <Group testID="contract-group" gap="sm">
        <Text>a</Text>
        <Text>b</Text>
      </Group>,
    );
    expect(getByTestId("contract-group")).toBeTruthy();
  });

  it("Text renders its label", async () => {
    const { getByText } = await render(
      <Text size="sm" weight="bold">
        shared text
      </Text>,
    );
    expect(getByText("shared text")).toBeTruthy();
  });

  it("Title renders as a header", async () => {
    const { getByText } = await render(<Title order={2}>shared title</Title>);
    expect(getByText("shared title")).toBeTruthy();
  });
});

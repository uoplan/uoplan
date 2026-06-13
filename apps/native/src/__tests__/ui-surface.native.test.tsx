import { render } from "@testing-library/react-native";

import { Badge, Card, Center, Divider, Loader, Paper, Text } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the surface/feedback
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser surface contract test in apps/web.
describe("@uoplan/ui surface primitives (native variants)", () => {
  it("Paper renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Paper testID="contract-paper" p="md" withBorder>
        <Text>paper content</Text>
      </Paper>,
    );
    expect(getByTestId("contract-paper")).toBeTruthy();
    expect(getByText("paper content")).toBeTruthy();
  });

  it("Card renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Card testID="contract-card">
        <Text>card content</Text>
      </Card>,
    );
    expect(getByTestId("contract-card")).toBeTruthy();
    expect(getByText("card content")).toBeTruthy();
  });

  it("Divider renders", async () => {
    const { getByTestId } = await render(<Divider testID="contract-divider" />);
    expect(getByTestId("contract-divider")).toBeTruthy();
  });

  it("Center renders its children", async () => {
    const { getByTestId, getByText } = await render(
      <Center testID="contract-center">
        <Text>centered</Text>
      </Center>,
    );
    expect(getByTestId("contract-center")).toBeTruthy();
    expect(getByText("centered")).toBeTruthy();
  });

  it("Badge renders its label", async () => {
    const { getByTestId, getByText } = await render(
      <Badge testID="contract-badge" tone="accent">
        new
      </Badge>,
    );
    expect(getByTestId("contract-badge")).toBeTruthy();
    expect(getByText("new")).toBeTruthy();
  });

  it("Loader renders", async () => {
    const { getByTestId } = await render(<Loader testID="contract-loader" />);
    expect(getByTestId("contract-loader")).toBeTruthy();
  });
});

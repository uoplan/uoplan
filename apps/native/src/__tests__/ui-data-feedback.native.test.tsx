import { fireEvent, render } from "@testing-library/react-native";

import { Notification, Table } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the data/feedback-tier
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors the
// web browser data/feedback contract test in apps/web.
describe("@uoplan/ui data/feedback-tier primitives (native variants)", () => {
  it("Table renders headers and cell values", async () => {
    const { getByText } = await render(
      <Table
        columns={[
          { key: "code", header: "Code" },
          { key: "grade", header: "Grade" },
        ]}
        rows={[
          { code: "CSI 2110", grade: "A+" },
          { code: "MAT 1320", grade: "B" },
        ]}
      />,
    );
    expect(getByText("Code")).toBeTruthy();
    expect(getByText("CSI 2110")).toBeTruthy();
    expect(getByText("A+")).toBeTruthy();
  });

  it("Notification renders title/body and fires onClose on press", async () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText } = await render(
      <Notification title="Saved" tone="success" onClose={onClose}>
        Your changes were saved.
      </Notification>,
    );
    expect(getByText("Saved")).toBeTruthy();
    expect(getByText("Your changes were saved.")).toBeTruthy();
    await fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Notification omits the close control when onClose is absent", async () => {
    const { queryByLabelText } = await render(<Notification title="Info">Body</Notification>);
    expect(queryByLabelText("Close")).toBeNull();
  });
});

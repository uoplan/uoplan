import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { Icon, Motion, SF_SYMBOL_FOR_ICON } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the Icon (SF Symbols)
// and Motion (RN Animated) primitives, same as the Metro device bundle. Mirrors
// the web browser Motion/Icon contract test in apps/web.
describe("@uoplan/ui Icon + Motion (native variants)", () => {
  it("Icon renders an SF Symbol host node", async () => {
    const view = await render(<Icon name="search" label="Search" testID="contract-icon" />);
    const json = JSON.stringify(view.toJSON());
    // expo-symbols renders a native SymbolView host component under jest-expo,
    // with the semantic name resolved to its SF Symbol.
    expect(json).toContain("SymbolModule");
    expect(json).toContain("magnifyingglass");
  });

  it("exposes an SF Symbol mapping for every semantic name", () => {
    expect(SF_SYMBOL_FOR_ICON.search).toBe("magnifyingglass");
    expect(SF_SYMBOL_FOR_ICON.calendar).toBe("calendar");
    expect(SF_SYMBOL_FOR_ICON.graph).toBe("point.3.connected.trianglepath.dotted");
  });

  it("Motion renders its children", async () => {
    const { getByText } = await render(
      <Motion testID="contract-motion" from={{ opacity: 0, translateY: 8 }} to={{ opacity: 1 }}>
        <View>
          <Text>animated content</Text>
        </View>
      </Motion>,
    );
    expect(getByText("animated content")).toBeTruthy();
  });
});

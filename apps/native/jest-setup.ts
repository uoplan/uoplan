// Reanimated 4 initializes react-native-worklets at import time; Jest has no
// native worklets runtime, so install Software Mansion's mocks before render
// tests import components that use GestureDetector + Animated shared values.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
require("react-native-reanimated").setUpTests();

// RNTL (v14) auto-extends Jest with its built-in matchers; this file is the
// single place to register any future global native mocks (e.g. expo-file-system,
// expo-notifications) used across native render tests.
import "@testing-library/react-native";

// The basket cart FAB is mounted per tab stack (via `GlobalBasketCart` in each
// tab's `_layout`) and reads from the basket / app-data / schedule-options
// providers. Screen-render tests that don't mount those providers can hit it
// transitively, so stub it out globally. Tests that specifically exercise the
// cart can override this mock per file.
jest.mock("@/components/basket-fab", () => ({
  BasketFab: () => null,
}));

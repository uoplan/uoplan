/**
 * Native test harness (T0).
 *
 * jest-expo is the Expo SDK 56 preset: it mocks the native module surface and
 * wires Metro-style platform resolution (`.native.tsx`/`.ios.tsx` win over
 * `.tsx`), so importing a `@uoplan/ui` primitive resolves its React Native
 * variant exactly like the device bundle does.
 *
 * Workspace packages (`@uoplan/*`) ship raw TypeScript and are symlinked into
 * node_modules, so they must be transpiled — hence the `@uoplan/.*` exception in
 * transformIgnorePatterns alongside the RN/Expo/svg families.
 */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["react-native-gesture-handler/jestSetup.js"],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  transformIgnorePatterns: [
    // pnpm nests real package files under `node_modules/.pnpm/<pkg>@v/node_modules/<pkg>`.
    // The leading `\.pnpm` exclusion stops the matcher from bailing at the outer
    // `.pnpm` segment so the allow-list is evaluated at the inner package dir.
    "node_modules/(?!\\.pnpm|(?:jest-)?react-native(?:-.*)?|@react-native(?:-community)?(?:/.*)?|expo(?:nent)?(?:/.*)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|moti|@uoplan/.*)",
  ],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  // pnpm gives workspace packages (e.g. @uoplan/ui) their own React copy; the
  // test runner must see a single React/React Native instance or the reconciler
  // breaks (`render` returns no queries). Force every import to the app's copy.
  // `@lingui/react` is keyed on its peer `react`, so packages/i18n (react 19.2.4)
  // and apps/native (Expo-pinned react 19.2.3) otherwise resolve two copies with
  // distinct React Context objects — the shared `useTr()`/`useLingui()` would not
  // see the native `<I18nProvider>`. Pin it (and the `i18n` core) to one instance.
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
    "^react/(.*)$": "<rootDir>/node_modules/react/$1",
    "^react-native$": "<rootDir>/node_modules/react-native",
    "^@lingui/core$": "<rootDir>/node_modules/@lingui/core",
    "^@lingui/core/(.*)$": "<rootDir>/node_modules/@lingui/core/$1",
    "^@lingui/react$": "<rootDir>/node_modules/@lingui/react",
    "^@lingui/react/(.*)$": "<rootDir>/node_modules/@lingui/react/$1",
    "\\.css$": "<rootDir>/jest-style-mock.js",
  },
};

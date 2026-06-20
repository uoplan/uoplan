// Metro applies babel-preset-expo implicitly, but jest-expo's babel-jest
// transformer needs an explicit Babel config to transpile React Native / Expo
// (and our raw-TS @uoplan/* workspace packages) for the Node test environment.

// Babel's CommonJS-interop transform injects helper functions named
// `_interopRequireDefault`, `_interopRequireWildcard`, and `_interopDefault`.
// When a dependency's own source declares a function named `interopDefault`
// (e.g. `unpdf`), the async-to-generator transform that `babel-preset-expo`
// forces on Expo DOM ('use dom') / WebView components generates an inner
// function ALSO named `_interopDefault`. The two `function _interopDefault`
// declarations collide; hoisting makes the async wrapper win, so the interop
// helper call `_interopDefault(require("@babel/runtime/helpers/asyncToGenerator"))`
// returns `undefined` and the module crashes at init with
// "undefined is not an object (evaluating '_asyncToGenerator.default')".
// This breaks on-device transcript parsing (the PDF extractor is a DOM component
// that imports `unpdf`). Pre-emptively rename any source binding whose name would
// reduce to a Babel interop-helper name, before those transforms run.
const INTEROP_HELPER_COLLISIONS = [
  "interopDefault",
  "interopRequireDefault",
  "interopRequireWildcard",
];

function fixBabelInteropHelperCollision() {
  return {
    name: "fix-babel-interop-helper-collision",
    visitor: {
      Program(path) {
        for (const name of INTEROP_HELPER_COLLISIONS) {
          if (path.scope.getBinding(name)) {
            path.scope.rename(name, path.scope.generateUid(`safe_${name}`));
          }
        }
      },
    },
  };
}

module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [fixBabelInteropHelperCollision],
  };
};

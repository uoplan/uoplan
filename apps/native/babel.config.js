// Metro applies babel-preset-expo implicitly, but jest-expo's babel-jest
// transformer needs an explicit Babel config to transpile React Native / Expo
// (and our raw-TS @uoplan/* workspace packages) for the Node test environment.
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};

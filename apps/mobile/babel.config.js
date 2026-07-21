module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated's plugin must always be listed last - required because App.tsx's navigation stack
    // (React Navigation's drawer + native-stack) uses reanimated under the hood for gesture-driven transitions.
    plugins: ["react-native-reanimated/plugin"]
  };
};

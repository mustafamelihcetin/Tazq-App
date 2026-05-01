const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Aliasing react-native-fs to expo-file-system to avoid native rebuilds
config.resolver.extraNodeModules = {
  'react-native-fs': require.resolve('expo-file-system'),
};

module.exports = withNativeWind(config, { input: "./global.css" });

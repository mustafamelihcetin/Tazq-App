const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Aliasing react-native-fs to expo-file-system to avoid native rebuilds
config.resolver.extraNodeModules = {
  'react-native-fs': require.resolve('expo-file-system'),
};

// Custom resolver to fix the Metro resolution bug for @react-native-google-signin/google-signin on Windows
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('errorCodes') && context.originModulePath.toLowerCase().includes('google-signin') && !moduleName.endsWith('.js')) {
    moduleName = moduleName + '.js';
  }
  return context.resolveRequest
    ? context.resolveRequest(context, moduleName, platform)
    : require('metro-resolver').resolve(context, moduleName, platform);
};


module.exports = withNativeWind(config, { input: "./global.css" });

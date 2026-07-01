const baseJson = require('./app.json');

// App variant: APP_VARIANT=dev YALNIZ iOS'a uygulanır — çünkü çakışma riski sadece
// iOS TestFlight'taki production TAZQ ile. iOS dev build'i "TAZQ Dev" / .dev bundle
// olur (yan yana durur). ANDROID HER ZAMAN düz "TAZQ" / com.tazqapp.tazq kalır.
const IS_DEV = process.env.APP_VARIANT === 'dev';
const base = baseJson.expo;

module.exports = {
  expo: {
    ...base,
    name: base.name,  // Android + genel ad: her zaman "TAZQ"
    ios: {
      ...base.ios,
      bundleIdentifier: IS_DEV ? `${base.ios.bundleIdentifier}.dev` : base.ios.bundleIdentifier,
      infoPlist: {
        ...(base.ios.infoPlist || {}),
        ...(IS_DEV ? { CFBundleDisplayName: 'TAZQ Dev' } : {}),
      },
    },
    android: {
      ...base.android,  // her zaman düz: "TAZQ" / com.tazqapp.tazq
    },
    extra: {
      ...base.extra,
      apiUrl: 'https://api.tazqapp.com',
    },
    plugins: [
      ...(base.plugins || []),
      [
        '@sentry/react-native/expo',
        {
          // EAS build sırasında source map yükleme (okunur stack trace).
          url: 'https://sentry.io/',
          project: 'tazq',
          organization: 'tazq',
        },
      ],
    ],
  },
};

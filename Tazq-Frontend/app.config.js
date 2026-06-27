const baseJson = require('./app.json');

module.exports = {
  expo: {
    ...baseJson.expo,
    extra: {
      ...baseJson.expo.extra,
      apiUrl: 'https://api.tazqapp.com',
    },
    plugins: [
      ...(baseJson.expo.plugins || []),
      [
        '@sentry/react-native/expo',
        {
          // Upload source maps during EAS builds for readable stack traces
          // Disabled in eas.json unless SENTRY_AUTH_TOKEN is configured for EAS.
          url: 'https://sentry.io/',
          project: 'tazq',
          organization: 'tazq-org',
        },
      ],
    ],
  },
};

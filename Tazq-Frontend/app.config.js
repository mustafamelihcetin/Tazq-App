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
          // Requires SENTRY_AUTH_TOKEN and SENTRY_ORG/SENTRY_PROJECT env vars in eas.json
          url: 'https://sentry.io/',
          project: 'tazq',
          organization: 'tazq-org',
        },
      ],
    ],
  },
};

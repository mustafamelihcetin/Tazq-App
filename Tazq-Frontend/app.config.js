const baseJson = require('./app.json');

module.exports = {
  expo: {
    ...baseJson.expo,
    extra: {
      ...baseJson.expo.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5200',
    },
  },
};

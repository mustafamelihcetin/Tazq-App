const baseJson = require('./app.json');

module.exports = {
  expo: {
    ...baseJson.expo,
    extra: {
      ...baseJson.expo.extra,
      apiUrl: 'https://api.tazqapp.com',
    },
  },
};

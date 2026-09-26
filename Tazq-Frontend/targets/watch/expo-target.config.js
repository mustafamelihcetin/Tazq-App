/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'watch',
  name: 'TazqWatch',
  displayName: 'TAZQ',
  deploymentTarget: '9.4',
  // App Group, telefonun app.config.js'te tanımladığı grupla AYNI olmalı —
  // Watch, veriyi doğrudan bu gruptan değil WatchConnectivity üzerinden alır,
  // ama complication (ileride eklenirse) buradan okuyacak.
  colors: { $accent: { color: '#0B6BCB', darkColor: '#0A84FF' } },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WatchKit'],
});

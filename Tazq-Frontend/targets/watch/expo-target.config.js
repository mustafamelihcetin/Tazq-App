/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'watch',
  name: 'TazqWatch',
  displayName: 'TAZQ',
  deploymentTarget: '9.4',
  /*
    ANA UYGULAMANIN İKONU DEĞİL — `icon-watch-opaque.png` kullanılıyor (2026-09).
    `assets/brand/icon.png` RGBA (alpha kanallı) — görünürde tam opak (alpha her
    pikselde 255) ama watchOS ikon doğrulaması SALT FORMAT'A bakıyor: alpha kanalı
    TAŞIYAN bir PNG, içeriği tamamen opak olsa bile reddedilebiliyor/eksik
    görünebiliyor. Ana uygulamanın kendi ikon işleme hattı (Expo'nun icon plugin'i)
    bunu otomatik düzleştiriyor ama `@bacons/apple-targets`'ın watch hedefi
    ikonu OLDUĞU GİBİ kopyalıyor. Bu yüzden Watch'ta "Kullanılabilir Uygulamalar"
    listesinde ikon boş görünüyordu — muhtemelen kurulumun sürekli "Yükle"ye
    dönmesinin de bir parçası. `icon-watch-opaque.png` AYNI görseli alpha'sız
    (RGB) olarak taşıyor — piksel piksel özdeş, yalnız format farklı.
  */
  icon: '../../assets/brand/icon-watch-opaque.png',
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

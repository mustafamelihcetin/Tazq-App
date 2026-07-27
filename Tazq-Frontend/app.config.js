const baseJson = require('./app.json');

/**
 * APP_VARIANT=dev → geliştirme sürümü production'ın YANINA kurulur, üstüne değil.
 *
 * Ayrım ÜÇ katmanda birden yapılmak zorunda; biri eksik kalırsa çakışma sürer:
 *
 *   1. paket/bundle kimliği — işletim sistemi uygulamaları BUNUNLA ayırt eder.
 *      Aynı kalırsa dev build production'ın üzerine kurulur ve VERİSİNİ SİLER.
 *   2. görünen ad — ikisi de "TAZQ" ise kullanıcı ana ekranda hangisinin hangisi
 *      olduğunu bilemez (ikonlar da aynı).
 *   3. URL şeması — aynı kalırsa `tazq-app://` bağlantısında Android "hangisiyle
 *      açılsın?" diye sorar, hatta yanlış olana gidebilir.
 *
 * Önceden bu yalnız iOS'a uygulanıyordu; Android düz bırakılmıştı. Android'de de
 * yan yana kurulum gerektiği için artık iki platform da aynı kuralı izliyor.
 */
const IS_DEV = process.env.APP_VARIANT === 'dev';
const base = baseJson.expo;

/** Dev sürümün adı — tek yerde, iki platform da buradan okur (ayrışamaz). */
const DEV_NAME = 'TAZQ Dev';
/** Kimlik son eki — paket adı, bundle id ve şema aynı eki alır. */
const DEV_SUFFIX = '.dev';

module.exports = {
  expo: {
    ...base,
    // Android'de `app_name` string kaynağı bundan doğar; iOS'ta CFBundleName.
    name: IS_DEV ? DEV_NAME : base.name,
    // Ayrı şema: iki sürüm birlikte kuruluyken derin bağlantı çakışmasın.
    scheme: IS_DEV ? `${base.scheme}-dev` : base.scheme,
    ios: {
      ...base.ios,
      bundleIdentifier: IS_DEV ? `${base.ios.bundleIdentifier}${DEV_SUFFIX}` : base.ios.bundleIdentifier,
      infoPlist: {
        ...(base.ios.infoPlist || {}),
        // iOS'ta ana ekranda görünen ad CFBundleName değil BUDUR.
        ...(IS_DEV ? { CFBundleDisplayName: DEV_NAME } : {}),
      },
    },
    android: {
      ...base.android,
      package: IS_DEV ? `${base.android.package}${DEV_SUFFIX}` : base.android.package,
    },
    extra: {
      ...base.extra,
      apiUrl: 'https://api.tazqapp.com',
      /**
       * Çalışma anında okunabilen sürüm bilgisi.
       *
       * `process.env.APP_VARIANT` uygulama paketinde OKUNAMAZ — Expo yalnız
       * `EXPO_PUBLIC_*` önekli değişkenleri gömer. Bu yüzden değeri derleme anında
       * buraya yazıyoruz; uygulama `Constants.expoConfig.extra.appVariant` ile alıyor.
       *
       * Kullanımı: her API isteğine `X-App-Variant` başlığı olarak gidiyor ki sunucu
       * geliştirme hatalarını canlı hatalardan ayırabilsin (bkz. shared/services/api.ts
       * ve Tazq-Backend/Services/LogSourceContext.cs).
       */
      appVariant: IS_DEV ? 'dev' : 'prod',
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

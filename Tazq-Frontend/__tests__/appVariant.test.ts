/**
 * DEV SÜRÜM AYRIMI — production'ın yanına kurulmalı, ÜSTÜNE değil.
 *
 * NEDEN TEST: bu ayrım üç ayrı alanda (paket kimliği, ad, şema) ve iki platformda
 * yapılıyor. Biri unutulursa hata sessizdir — build başarıyla çıkar, uygulama
 * çalışır, sorun ancak cihazda "production sürümüm nereye gitti?" diye fark edilir.
 * O noktada kullanıcının verisi çoktan silinmiş olur (aynı paket kimliği = üzerine
 * kurulum). Derleme zamanında yakalanmayan, geri alınamayan bir hata sınıfı.
 *
 * Android bir süre bilinçli olarak ayrımın DIŞINDA bırakılmıştı; artık değil.
 * Bu test iki platformu da aynı kurala bağlar.
 */

const loadConfig = (variant?: string) => {
  const prev = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;

  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require('../app.config.js').expo;

  if (prev === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = prev;

  return cfg;
};

describe('APP_VARIANT=dev — yan yana kurulum', () => {
  const prod = loadConfig(undefined);
  const dev = loadConfig('dev');

  it('production yapılandırması APP_VARIANT olmadan hiç değişmez', () => {
    expect(prod.name).toBe('TAZQ');
    expect(prod.android.package).toBe('com.tazqapp.tazq');
    expect(prod.ios.bundleIdentifier).toBe('com.tazqapp.tazq');
    expect(prod.scheme).toBe('tazq-app');
    expect(prod.ios.infoPlist.CFBundleDisplayName).toBeUndefined();
  });

  it('görünen ad iki platformda da "TAZQ Dev"', () => {
    // Android bunu `name`den, iOS CFBundleDisplayName'den okur — ikisi de gerekli.
    expect(dev.name).toBe('TAZQ Dev');
    expect(dev.ios.infoPlist.CFBundleDisplayName).toBe('TAZQ Dev');
  });

  it('paket kimliği ayrışır — ASIL koruma, üzerine kurulumu engelleyen tek şey', () => {
    expect(dev.android.package).toBe('com.tazqapp.tazq.dev');
    expect(dev.ios.bundleIdentifier).toBe('com.tazqapp.tazq.dev');
    expect(dev.android.package).not.toBe(prod.android.package);
    expect(dev.ios.bundleIdentifier).not.toBe(prod.ios.bundleIdentifier);
  });

  it('URL şeması ayrışır — iki sürüm birlikte kuruluyken bağlantı çakışmasın', () => {
    expect(dev.scheme).toBe('tazq-app-dev');
    expect(dev.scheme).not.toBe(prod.scheme);
  });

  it('geri kalan her şey production ile AYNI kalır', () => {
    // Ayrım kimlikle sınırlı olmalı: dev build'in davranışı prod'dan farklıysa
    // test ettiğin şey yayınlayacağın şey olmaz.
    expect(dev.version).toBe(prod.version);
    expect(dev.plugins).toEqual(prod.plugins);
    expect(dev.extra.apiUrl).toBe(prod.extra.apiUrl);
    expect(dev.android.permissions).toEqual(prod.android.permissions);
    expect(dev.ios.infoPlist.NSHealthShareUsageDescription)
      .toBe(prod.ios.infoPlist.NSHealthShareUsageDescription);
  });
});

/**
 * DEĞİŞKENİ KİM VERİYOR — asıl tuzak burada.
 *
 * `app.config.js` doğru yazılmış olsa bile, `APP_VARIANT`i geliştirme sunucusuna
 * vermeyi unutmak sessiz DEĞİL ama YANILTICI bir hata veriyor:
 *
 *     No development build (com.tazqapp.tazq) for this project is installed.
 *     Install a development build on the target device and try again.
 *
 * Cihazda build KURULUDUR; yalnızca paket adı `com.tazqapp.tazq.dev`dir. Metro
 * `app.config.js`i kendi ortamında değerlendirdiği için değişken yokken production
 * kimliğini arar. Hata mesajı insanı "build bozuk" sanıp yeniden build almaya
 * yönlendiriyor — EAS'te 20 dakika.
 *
 * KURAL: yerelde cihaza dokunan her komut dev sürümü hedefler. Uzaktaki (EAS)
 * build'ler değişkeni eas.json'daki profilinden alır; oraya karışmıyoruz.
 */
describe('APP_VARIANT komutlara bağlı — unutulamaz', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const scripts = require('../package.json').scripts as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const eas = require('../eas.json');

  // Cihazda çalışan/derleyen yerel komutlar. `web` yok: tarayıcıda paket kimliği
  // diye bir şey olmadığı için ayrımın karşılığı da yok.
  it.each(['start', 'dev', 'android', 'ios', 'prebuild:dev'])(
    '`%s` dev sürümü hedefler',
    (name) => {
      expect(scripts[name]).toContain('APP_VARIANT=dev');
    },
  );

  it('production kimliğine bağlanmak için BİLİNÇLİ bir kaçış kapısı var', () => {
    // Cihazda production build'i varken Metro'ya bağlanmak isteyen için. Ayrı isim:
    // varsayılanı bozmadan istisnayı mümkün kılar.
    expect(scripts['start:prod']).toBeDefined();
    expect(scripts['start:prod']).not.toContain('APP_VARIANT');
  });

  it('cross-env kurulu — değişken Windows kabuklarında da geçer', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json');
    expect(pkg.devDependencies['cross-env']).toBeDefined();
    // `VAR=x komut` sözdizimi PowerShell/cmd'de çalışmaz; script'ler orada sessizce
    // production kimliğiyle açılırdı.
    for (const [name, cmd] of Object.entries(scripts)) {
      if (cmd.includes('APP_VARIANT=')) {
        expect(`${name}: ${cmd}`).toContain('cross-env APP_VARIANT=');
      }
    }
  });

  it('EAS profilleri: dev/preview ayrışır, production ASLA', () => {
    expect(eas.build.development.env.APP_VARIANT).toBe('dev');
    expect(eas.build.preview.env.APP_VARIANT).toBe('dev');
    // Buraya `dev` sızarsa mağazaya "TAZQ Dev" adıyla, yanlış paketle çıkarsın.
    expect(eas.build.production.env?.APP_VARIANT).toBeUndefined();
  });
});

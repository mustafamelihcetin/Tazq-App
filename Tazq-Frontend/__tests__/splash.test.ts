import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const SPLASH = stripComments(read('shared/components/AnimatedSplash.tsx'));
const LAYOUT = stripComments(read('app/_layout.tsx'));
const APP_JSON = JSON.parse(read('app.json'));
const { Colors } = require('@/shared/constants/Colors');

const splashPlugin = (APP_JSON.expo.plugins as any[]).find(
  (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
)?.[1];

/**
 * AÇILIŞTA SIÇRAMA OLMAZ.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Açılışta göz hareketi değil RENK SIÇRAMASINI yakalar. Üç ayrı zemin vardı:
 *
 *     Android penceresi #000000 → sistem splash'i #1E2A66 → bu ekran #F4F4F5
 *
 * ── BİR DENEME GERİ ALINDI ────────────────────────────────────────────────────
 * Önce tam tersi yapıldı: açılışın TAMAMI marka lacivertine boyandı. Geri alındı —
 * o renk uygulamanın hiçbir yerinde yok (palet soğuk nötrler + mavi vurgu), tam ekran
 * kaplayınca boğuyor ve içeri girerken başka bir dünyaya geçiliyormuş gibi duruyordu.
 *
 * Şimdiki kural: açılış, uygulamanın İLK EKRANINA benzer — aynı zemin rengi, üstünde
 * yalnız kelime işareti. Bu dosya o eşitlikleri kilitliyor; biri değişip diğeri kalırsa
 * sıçrama sessizce döner.
 */
describe('açılış — sistem splash\'i ile aynı zemin', () => {
  it('açık tema zemini uygulamanın zemini', () => {
    expect(splashPlugin.backgroundColor.toUpperCase()).toBe(Colors.light.background.toUpperCase());
  });

  it('koyu tema için AYRI zemin tanımlı', () => {
    expect(splashPlugin.dark.backgroundColor.toUpperCase()).toBe(Colors.dark.background.toUpperCase());
  });

  it('lacivert tam ekran alan olarak geri gelmesin', () => {
    expect(JSON.stringify(APP_JSON)).not.toContain('#1E2A66');
    expect(SPLASH).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('Android penceresi de aynı — siyah adım kalmadı', () => {
    expect(APP_JSON.expo.android.backgroundColor.toUpperCase()).toBe(Colors.light.background.toUpperCase());
  });

  it('sistem splash\'inde marka logosu var — uygulama ikonu konmaz', () => {
    /*
      Bir tur, devir teslim görünmesin diye sistem splash'ine uygulama ikonu konuldu ve
      bu ekran da aynı ikonu çizdi. Geri alındı: kullanıcı zaten o ikona basarak geldi,
      açılışta ikinci kez göstermek fazlalık.

      2026-10-20: sistem splash'ine ikon DEĞİL, ayrı marka logosu (splash_logo.png)
      bilerek eklendi. Kural hâlâ geçerli: uygulama ikonu açılışta tekrar gösterilmez.

      (Android 12+ sistemin kendi başlatıcı ikonunu gösteriyor; o davranış bizde değil.)
    */
    /*
      2026-10-29: açık temada logo KOYU (splash_logo_dark.png). splash_logo.png tamamen
      beyazdı; #F4F4F5 zeminde neredeyse görünmüyor, ardından gelen AnimatedSplash ise
      koyu yazıyla açılıyordu — "beyaz ekranda beyaz logo, sonra splash" geçişi.
    */
    expect(splashPlugin.image).toBe('./assets/brand/splash_logo_dark.png');
    expect(splashPlugin.dark.image).toBe('./assets/brand/splash_logo.png');
    expect(splashPlugin.image).not.toContain('icon.png');
    expect(SPLASH).not.toContain('icon.png');
  });

  it('marka anı: sürüm başına üç sözcük + kendini çizen işaretler + 3B ipek kuşaklar + TAZQ imzası', () => {
    /*
      2026-10-31, beş deneme sonrası: küçük logo / halka / dev TAZQ reddedildi ("anlamsız, boş").
      Açılış uygulamanın vaadini söyler; kuşaklar YAZISIZ süs (kullanıcı), 3B ışıklı ipek.
    */
    expect(SPLASH).toContain('<SilkRibbon');
    expect(SPLASH).toContain('<SplashGlyph');
    expect(SPLASH).toContain('<TazqLogo');
    expect(SPLASH).toContain('withSpring(1, RIBBON_SPRING)');
    // Renk sürümün küratörlü seti — kişinin vurgusu DEĞİL.
    expect(SPLASH).toContain('SplashEditionColors.');
    expect(SPLASH).not.toContain('theme.primary');
  });

  it('her açılış aynı değil: sürüm (sözcük + işaret + renk + düzen) açılış başına seçilir', () => {
    const editions = SPLASH.match(/\{ id: '[a-z]+', label:/g) ?? [];
    expect(editions.length).toBeGreaterThanOrEqual(4);
    expect(SPLASH).toContain('EDITIONS[Math.floor(Math.random() * EDITIONS.length)]');
    expect(SPLASH).toContain('edition.mirror');
  });

  it('hareketi azalt: kuşaklar ve sözcükler yerinde başlar; hazır olmadan kapanmaz', () => {
    expect(SPLASH).toContain('useSharedValue(reduceMotion ? 1 : 0)');
    expect(SPLASH).toContain('if (!ready || outroStarted.current) return;');
  });

  it('zemin dokusu ana ekranla AYNI — açılış uygulamanın tuvalinin ilk hâli', () => {
    /*
      Düz bir renk alanı "ayrı bir ekran" gibi duruyordu. Ana ekranın kendi yüzeyi
      buraya da uzanınca içeri giriş, ekran değişimi değil devam gibi okunuyor.
    */
    expect(SPLASH).toContain('<DottedBackground');
    const home = read('app/index.tsx');
    for (const prop of ['opacity={isDark ? 0.05 : 0.08}', 'size={24}', 'dotSize={1}']) {
      expect(SPLASH).toContain(prop);
      expect(home).toContain(prop);
    }
  });
});

describe('açılış bir KÖPRÜ: sistemde başlar, uygulamada biter', () => {
  /*
    ── ÖLÇÜLEN SORUN ────────────────────────────────────────────────────────────
    Bir tur açılış YALNIZCA işletim sisteminin görünümünü izliyordu. Gerekçesi
    sağlamdı (sistem splash'inden devralma görünmesin) ama sonucu yanlıştı ve
    kullanıcı tablette yakaladı: TAZQ'yu AÇIK temada kullanan biri, tableti koyu
    moddaysa KOYU bir açılış görüp aydınlık bir uygulamaya giriyordu. Sıçrama yok
    olmamış, yalnızca sona — içeri girilen ana — taşınmıştı.

    Çözüm iki uçtan birini seçmek değil, ikisini bağlamak: zemin sistem renginde
    başlıyor, ekran daha boşken uygulamanın rengine geçiyor.
  */
  it('iki ucu da tanıyor: devralınan renk ve varılan renk', () => {
    expect(SPLASH).toContain('useColorScheme()');   // devralınan
    expect(SPLASH).toContain('useAppTheme');        // varılan
    expect(SPLASH).toContain('const needsBridge = bg !== systemBg;');
  });

  it('geçiş AYRI katmanda — kabın kendi opaklığıyla çakışmasın', () => {
    /*
      Uygulamanın rengi, sistem renginin ÜSTÜNDE açılan ayrı bir katman; kabın opaklığı (çıkış)
      ayrı değer. 2026-10-31'den beri ikisi de Reanimated (UI iş parçacığı).
    */
    expect(SPLASH).toContain('bridgeStyle');
    expect(SPLASH).toMatch(/\{ backgroundColor: bg \}, bridgeStyle\]/);
  });

  it('geçiş tema (ve dil) DİSKTEN okunduktan sonra başlar', () => {
    // Erken başlasa yanlış renge/dile geçip geri dönerdi.
    expect(SPLASH).toContain('useThemeHydrated');
    expect(SPLASH).toContain('useThemeStore.persist.hasHydrated()');
    expect(SPLASH).toContain('useLanguageStore.persist.hasHydrated()');
    expect(SPLASH).toContain('const shown = themeReady && langReady && prefsReady && canStart;');
  });

  it('mürekkep VARILAN renge göre — açık zemine beyaz yazı düşmesin', () => {
    expect(SPLASH).toContain("variant={isDark ? 'white' : 'dark'}");
    expect(SPLASH).toContain("const isDark = colorScheme === 'dark';");
  });

  it('sistem çubukları da uygulamanın temasını izler', () => {
    // Açılışta ayrı kural YOK: açık zemin üstünde açık simgeler okunmuyordu.
    expect(LAYOUT).toContain('const dark = isDark;');
    expect(LAYOUT).not.toMatch(/const dark = onSplash \? splashDark : isDark;/);
  });
});

describe('açılış — süre ve erişilebilirlik', () => {
  const num = (name: string) => {
    const m = SPLASH.match(new RegExp(`${name} = (\\d+)`));
    expect(m).not.toBeNull();
    return Number(m![1]);
  };

  it('toplam açılış bütçesi 2 sn altında', () => {
    /*
      Ayar geçmişi (kullanıcı, cihazda): 1.0 sn "çok hızlı, oturmadı" → 1.5 "bi tık hızlı" → 1.9.
      Üç sözcük OKUNACAK ve kuşaklar OTURACAK; 2 sn üstü yine "bekliyorum" hissi verir.
    */
    expect(num('INTRO_TOTAL') + num('OUTRO')).toBeLessThan(2000);
  });

  it('"Hareketi Azalt" açıkken hiçbir şey hareket etmez', () => {
    expect(SPLASH).toContain('useReduceMotion');
    expect(SPLASH).toContain('useSharedValue(reduceMotion ? 1 : 0)');
    expect(SPLASH).toMatch(/if \(reduceMotion \|\| !enabled\) \{[\s\S]{0,200}setIntroDone\(true\);/);
  });

  it('admin yönetimi: kart yalnız süper admine çizilir; sabit sürüm ve kapalı açılış uygulanır', () => {
    const settings = read('app/settings.tsx');
    expect(settings).toContain("{canStaff(user?.role, 'super') && <SplashAdminCard");
    expect(SPLASH).toContain('EDITIONS.find(e => e.id === forced)');
    expect(SPLASH).toContain('{shown && enabled && (');
    expect(LAYOUT).toContain('key={previewNonce}');
  });

  it('zayıf Android: kuşak daha az parçayla ve bulanık gölgesiz çizilir', () => {
    expect(SPLASH).toContain('useLowPowerGraphics()');
    const ribbon = read('shared/components/SilkRibbon.tsx');
    expect(ribbon).toContain('const segs = lowPower ? SEGMENTS_LOW : SEGMENTS;');
    expect(ribbon).toContain('{!lowPower && (');
  });

  it('tercih İKİ platformda da okunuyor — Android\'de de var', () => {
    const hook = stripComments(read('shared/hooks/useReduceMotion.ts'));
    expect(hook).toContain('isReduceMotionEnabled');
    expect(hook).toContain('reduceMotionChanged');
    // Şeffaflık tercihinin aksine burada platform kapısı YOK.
    expect(hook).not.toContain("Platform.OS !== 'ios'");
  });

  it('uygulama hazır olana kadar kaybolmaz — boş ekran yok', () => {
    expect(SPLASH).toContain('if (!ready || outroStarted.current) return;');
  });

  it('titreşim TEK dokunuş ve kullanıcı tercihine saygılı', () => {
    // Çift vuruş ("kalp atışı") açılışta marka anından çok bildirim gibi okunuyordu.
    expect((SPLASH.match(/haptic\./g) ?? [])).toHaveLength(1);
    expect(read('shared/utils/haptics.ts')).toContain('if (enabled())');
  });
});

describe('açılış — ağaçla birlikte akıcılık', () => {
  /*
    2026-10-31: açılış uygulama ağacının ÜSTÜNDE katman (altta gerçek ana sayfa → beyaz ekran yok).
    Ölçülen iki kusur ve kuralları:
      · Ağaç kurulurken animasyon başlarsa ana iş parçacığı tıkanıyor: iOS'ta kuşaklar donup son
        karesine atladı → giriş, ağaç kurulup iki kare geçince başlar (canStart).
      · Çıkış JS zamanlayıcısına bağlıyken Android'de açılış ~12 sn kaldı → çıkış UI'da planlanır.
  */
  it('giriş ağaç kurulunca başlar, çıkış UI iş parçacığında planlanır', () => {
    expect(LAYOUT).toContain('canStart={treeMounted}');
    expect(LAYOUT).toContain('<MountedSignal onMounted={() => setTreeMounted(true)} />');
    expect(SPLASH).toContain('if (ready) startOutro(INTRO_TOTAL);');
    expect(SPLASH).toContain('tailA.value = withDelay(delay,');
  });

  it('açılış katmanı dokunuşu engellemez; uygulama ağacının üstünde, aynı yerde kalır', () => {
    expect(LAYOUT).toContain('<View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>');
    expect(LAYOUT).toContain('{splashLayer}');
  });
});

describe('açılış — dokunsal koreografi', () => {
  it('hareketle senkron dört vuruş; Android tek desen (JS zamanlayıcısına bağlı değil)', () => {
    // Kullanıcı: "titreşim de buna uygun, hisli olmalı". Yumuşak · tık · tık · sert.
    expect(SPLASH).toContain('haptic.splash([');
    expect(SPLASH).toContain("kind: 'soft'");
    expect(SPLASH).toContain("kind: 'firm'");
    const api = read('shared/utils/haptics.ts');
    expect(api).toContain('Vibration.vibrate(pattern);');
    expect(api).toContain('if (!enabled() || beats.length === 0) return noop;');
  });
});

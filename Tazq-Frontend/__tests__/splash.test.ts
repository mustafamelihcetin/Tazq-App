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

  it('sistem splash\'i YALNIZCA renk — uygulama ikonu konmaz', () => {
    /*
      Bir tur, devir teslim görünmesin diye sistem splash'ine uygulama ikonu konuldu ve
      bu ekran da aynı ikonu çizdi. Geri alındı: kullanıcı zaten o ikona basarak geldi,
      açılışta ikinci kez göstermek fazlalık. Marka anı kelime işaretiyle kuruluyor.

      (Android 12+ sistemin kendi başlatıcı ikonunu gösteriyor; o davranış bizde değil.)
    */
    expect(splashPlugin.image).toBeUndefined();
    expect(splashPlugin.dark.image).toBeUndefined();
    expect(SPLASH).not.toContain('icon.png');
  });

  it('marka anı: işaret belirir, nabız atar, çizgi açılır', () => {
    expect(SPLASH).toContain('<TazqLogo');
    expect(SPLASH).toContain('styles.line');
    // Nabız bir tur kaldırılmıştı; onsuz açılış "duran bir yazı" oluyor.
    expect(SPLASH).toContain('markScale');
    expect(SPLASH).toContain('toValue: 1.035');
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

  it('geçiş AYRI katmanda — yerel sürücüyle çakışmasın', () => {
    /*
      Renk yerel sürücüde canlandırılamaz. Kabın kendisine verilseydi aynı View
      üstünde biri JS biri yerel iki animasyon olur ve RN bunu reddeder.
    */
    expect(SPLASH).toContain('bridgeOpacity');
    expect(SPLASH).toMatch(/opacity: bridgeOpacity[\s\S]{0,40}\/>/);
    expect(SPLASH).toContain('useNativeDriver: false');
  });

  it('geçiş tema DİSKTEN okunduktan sonra başlar', () => {
    // Erken başlasa yanlış renge geçip geri dönerdi.
    expect(SPLASH).toContain('useThemeHydrated');
    expect(SPLASH).toContain('useThemeStore.persist.hasHydrated()');
    expect(SPLASH).toContain('if (!themeReady) return;');
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

  it('toplam açılış bütçesi 1.5 sn altında', () => {
    // Sektör eşiği 1–1.5 sn; 2 sn üstü "bekliyorum" hissi verir. Önceki hâl 1.85 sn idi.
    const total =
      num('INTRO_HOLD') + num('INTRO_MARK') +
      num('INTRO_PULSE_UP') + num('INTRO_PULSE_DOWN') +
      num('INTRO_LINE') + num('OUTRO_FADE');
    expect(total).toBeLessThan(1500);
  });

  it('"Hareketi Azalt" açıkken hiçbir şey hareket etmez', () => {
    expect(SPLASH).toContain('useReduceMotion');
    expect(SPLASH).toMatch(/useRef\(new Animated\.Value\(reduceMotion \? 1 : 0\)\)/);
    expect(SPLASH).toMatch(/if \(reduceMotion\) \{[\s\S]{0,200}setIntroDone\(true\);/);
  });

  it('tercih İKİ platformda da okunuyor — Android\'de de var', () => {
    const hook = stripComments(read('shared/hooks/useReduceMotion.ts'));
    expect(hook).toContain('isReduceMotionEnabled');
    expect(hook).toContain('reduceMotionChanged');
    // Şeffaflık tercihinin aksine burada platform kapısı YOK.
    expect(hook).not.toContain("Platform.OS !== 'ios'");
  });

  it('uygulama hazır olana kadar kaybolmaz — boş ekran yok', () => {
    expect(SPLASH).toContain('if (!introDone || !ready) return;');
  });

  it('titreşim TEK dokunuş ve kullanıcı tercihine saygılı', () => {
    // Çift vuruş ("kalp atışı") açılışta marka anından çok bildirim gibi okunuyordu.
    expect((SPLASH.match(/haptic\./g) ?? [])).toHaveLength(1);
    expect(read('shared/utils/haptics.ts')).toContain('if (enabled())');
  });
});

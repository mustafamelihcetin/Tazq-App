import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, useColorScheme, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { Canvas } from '@shopify/react-native-skia';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { DottedBackground } from './DottedBackground';
import { SilkRibbon, type RibbonPath } from './SilkRibbon';
import { SplashGlyph, type GlyphKind } from './SplashGlyph';
import { haptic } from '@/shared/utils/haptics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useSplashPrefs } from '@/shared/store/useSplashPrefs';
import { Colors, SplashEditionColors } from '@/shared/constants/Colors';

/**
 * AÇILIŞ EKRANI — "PLANLA. ODAKLAN. TAMAMLA." + KUŞAKLAR (2026-10-31).
 *
 * Geri dönen denemeler: küçük kelime + çizgi (cılız); vurgu renginde halka (anlamsız, vurguyla
 * ilgisi olmamalı); dev TAZQ + ışık (bomboş); alt alta üç sözcük ~1.7 sn ("çok uzun, millet
 * kaçar"); yazılı kuşaklar (kullanıcı: "kuşakları SÜS olarak, önceki hâline ek olarak
 * düşünmüştüm").
 *
 * Şimdi ~1 sn:
 *   · Uygulamanın vaadi, üç sözcük, neredeyse birlikte gelir; her birinin işareti kendini çizer:
 *       ≡ Planla.   (görev listesi)   ◔ Odaklan.   (odak halkası)   ✓ Tamamla.   (tamamlandı tiki)
 *   · Üstte saate göre küçük bir selam — her açılış aynı değil.
 *   · Arkada YAZISIZ iki kuşak (marka mavisi + mürekkep) zıt yönlerden YAY FİZİĞİYLE gelip
 *     ekranı çapraz çerçeveler; çıkışta geldikleri yönde fırlayıp gider — içeri girilir.
 * Renkler MARKA (temel jetonlar), kişinin vurgusu değil. Yazı SİSTEM yazı tipi.
 *
 * ── KORUNAN KURALLAR ─────────────────────────────────────────────────────────
 *  · ZEMİN KÖPRÜSÜ: sistem renginde başlar, tema diskten okununca uygulamanın rengine geçer.
 *  · Sistem splash'i yalnız renk + logo; uygulama ikonu ikinci kez gösterilmez.
 *  · Zemin dokusu ana ekranla birebir aynı (DottedBackground).
 *  · Hazır olmadan kapanmaz (ready); Hareketi Azalt açıkken her şey son hâliyle durur.
 *  · Tema VE dil diskten okunmadan hiçbir şey çizilmez (yanlış renk/dil bir an bile görünmesin).
 */

/**
 * Zamanlama (ms). Toplam ≈ INTRO_TOTAL + OUTRO ≈ 1.9 sn. Ayar geçmişi (kullanıcı, cihazda): 1.7 sn yavaş
 * (aslında 8× yavaşlatılmış önizlemeydi) → 1.0 "çok hızlı, oturmadı" → 1.5 "bi tık hızlı" → 1.9: kuşaklar
 * açılır ve OTURUR, sözcükler okunur, kısa bir duruştan sonra çıkılır.
 */
const WORD_STEP = 140;      // sözcükler neredeyse birlikte — okunur ama beklenmez
const GLYPH_DRAW = 440;
const RIBBON_B_DELAY = 140; // ikinci kuşak ilkini keser
const INTRO_TOTAL = 1480;
const OUTRO = 440;
const BG_BRIDGE = 200;
/** Yay: ağır bir ipek şerit — açılırken hafif taşar, sekmeden oturur. */
const RIBBON_SPRING = { mass: 1.3, damping: 24, stiffness: 80 } as const;

/** '#RRGGBB' → [r, g, b] (kuşağın ışık hesabı sayılarla çalışır). */
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const WORD_SPRING = { mass: 0.7, damping: 15, stiffness: 220 } as const;

/**
 * İMZA = SİSTEM SPLASH'İNİN LOGOSU (2026-11-01, kullanıcı: "yazı kayarak imzaya dönsün").
 * Sistem splash'i ortada TAZQ çiziyor, bu ekran ise boş zeminle açılıyordu: yazı bir anda
 * kayboluyordu. Artık ilk karede AYNI görsel AYNI yerde durur, sonra küçülerek alttaki imza
 * yerine kayar — tek, kesintisiz bir açılış. Ayrı bir imza logosu (TazqLogo) yok: iki logonun
 * oranı farklıydı, birinden ötekine geçiş göze batardı.
 *
 * Ölçüler (bkz. __tests__/splashGeometry):
 *  · expo-splash-screen logoyu app.json imageWidth (113 dp) karesinde, ekranın tam ortasına çizer
 *    (iOS: storyboard kare, Android: 288 dp tuvalin ortasında). Cihazda doğrulandı (MRD-LX1).
 *  · splash_logo*.png 1024×1024, simgedeki işçilikli kelime işaretinin MALZEMELİ hâli: açıkta
 *    kâğıda basılmış grafit, koyuda simgenin gümüşü. Harf gövdesi 943×303 → ekranda 104 dp
 *    (42 "çok küçük", 160 "devasa", 120 "bir tık büyük"; düz siyah dokuyu bozdu, düz gri ucuz durdu).
 *    Ölçüler HARF gövdesinin; gölge/ışık katmanları kutuyu birkaç piksel taşar, yerleşimi kaydırmaz.
 *  · Büyük harfler karenin dikey ortasında; Q'nun kuyruğu aşağı sarktığı için mürekkep kutusu
 *    ortadan biraz aşağıda (üst pay 374, alt pay 347) — imza konumu bunu hesaba katar.
 */
const NATIVE_LOGO = 113;
const NATIVE_INK_W = 943 / 1024;
const NATIVE_INK_H = 303 / 1024;
const NATIVE_INK_TOP = 374 / 1024;
const NATIVE_INK_BOTTOM = 347 / 1024;
const NATIVE_LOGO_DARK = require('../../assets/brand/splash_logo_dark.png');
const NATIVE_LOGO_WHITE = require('../../assets/brand/splash_logo.png');
/** Sistem splash'i kapandıktan sonra logonun yerinde durduğu kısa an, sonra kayış. */
const GLIDE_DELAY = 90;
const GLIDE = 760;

const GREET = {
  tr: { locale: 'tr-TR', greet: (h: number) => (h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : h < 23 ? 'İyi akşamlar' : 'İyi geceler') },
  en: { locale: 'en-US', greet: (h: number) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 23 ? 'Good evening' : 'Good night') },
} as const;

/**
 * SÜRÜMLER — "splash her seferinde aynısı olmaz; renk, içerik, komple değişmeli" (kullanıcı).
 * Her açılış bir sürüm seçer: üç sözcük + onların işaretleri + kuşak rengi + kuşak düzeni.
 * Renkler sabit küratörlü set (ayar çipleriyle aynı aile), kişinin vurgusu DEĞİL. İkinci kuşak
 * her sürümde mürekkep — sürümler değişse de marka bağı aynı kalır.
 */
interface Edition { id: string; label: { tr: string; en: string }; words: { tr: readonly string[]; en: readonly string[] }; glyphs: readonly GlyphKind[]; color: { readonly light: string; readonly dark: string }; mirror: boolean }
const EDITIONS: readonly Edition[] = [
  { id: 'blue', label: { tr: 'Mavi', en: 'Blue' }, words: { tr: ['Planla', 'Odaklan', 'Tamamla'], en: ['Plan', 'Focus', 'Finish'] }, glyphs: ['list', 'ring', 'check'], color: SplashEditionColors.blue, mirror: false },
  { id: 'teal', label: { tr: 'Deniz', en: 'Teal' }, words: { tr: ['Nefes al', 'Odaklan', 'Akışa gir'], en: ['Breathe', 'Focus', 'Flow'] }, glyphs: ['wave', 'ring', 'arrow'], color: SplashEditionColors.teal, mirror: true },
  { id: 'coral', label: { tr: 'Mercan', en: 'Coral' }, words: { tr: ['Başla', 'Sürdür', 'Bitir'], en: ['Start', 'Keep going', 'Finish'] }, glyphs: ['arrow', 'wave', 'check'], color: SplashEditionColors.coral, mirror: false },
  { id: 'lavender', label: { tr: 'Lavanta', en: 'Lavender' }, words: { tr: ['Yaz', 'Seç', 'Yap'], en: ['Write', 'Choose', 'Do'] }, glyphs: ['list', 'spark', 'check'], color: SplashEditionColors.lavender, mirror: true },
];

/** Admin kartındaki sürüm seçenekleri (bkz. SplashAdminCard). */
export const SPLASH_EDITIONS = EDITIONS.map(e => ({ id: e.id, label: e.label }));

/** Tema tercihi diskten OKUNDU mu? Okunmadan başlarsa yanlış renge geçip geri döner. */
function useThemeHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useThemeStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useThemeStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);
  return hydrated;
}

/** Dil tercihi diskten OKUNDU mu? Sözcükler bir an yanlış dilde görünmesin. */
function useLanguageHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useLanguageStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useLanguageStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);
  return hydrated;
}

/** Admin açılış ayarları diskten OKUNDU mu? (Sabitlenmiş sürüm / kapalı açılış bir an bile ıskalanmasın.) */
function useSplashPrefsHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useSplashPrefs.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useSplashPrefs.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);
  return hydrated;
}

/** Bir sözcük satırı: yaydan gelir, işareti kendini çizer. */
function WordRow({ word, kind, fontSize, glyph, ink, brand, track, enter, draw }: {
  word: string; kind: GlyphKind; fontSize: number; glyph: number; ink: string; brand: string; track: string;
  enter: SharedValue<number>; draw: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.5),
    transform: [{ translateY: (1 - enter.value) * fontSize * 0.5 }],
  }));
  return (
    <Animated.View style={[styles.row, { gap: Math.round(fontSize * 0.34) }, style]}>
      <SplashGlyph kind={kind} size={glyph} color={brand} track={track} progress={draw} />
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize, lineHeight: Math.round(fontSize * 1.12), fontWeight: '700', letterSpacing: -fontSize * 0.02, color: ink }}>
        {word}<Text style={{ color: brand }}>.</Text>
      </Text>
    </Animated.View>
  );
}

export const AnimatedSplash = ({
  onFinish,
  onReady,
  onExitStart,
  ready = true,
  canStart = true,
}: {
  onFinish: () => void;
  onReady: () => void;
  /** Çıkış başlıyor: alttaki ekran hâlâ örtülüyken sistem çubuğu geri gelsin (bkz. _layout). */
  onExitStart?: () => void;
  /** Uygulama gerçekten hazır mı (font + varlık)? Giriş bitse de hazır değilse açılış durur. */
  ready?: boolean;
  /**
   * Giriş başlayabilir mi? Uygulama ağacı açılışın ALTINDA kurulurken ana iş parçacığı yerel
   * görünümleri yaratmakla meşgul: animasyon o sırada başlarsa donup kapanışta son karesine
   * atlıyordu (iOS'ta görüldü). Kök düzen ağaç kurulup iki kare geçince true verir; o ana kadar
   * yerel (durağan) açılış ekranda kalır.
   */
  canStart?: boolean;
}) => {
  const systemScheme = useColorScheme();
  const { colorScheme } = useAppTheme();
  const reduceMotion = useReduceMotion();
  /* Zayıf Android: kuşak daha az parçayla, bulanık gölgesiz çizilir (kare kaçırmasın). */
  const lowPower = useLowPowerGraphics();
  const { width, height } = useWindowDimensions();
  const themeReady = useThemeHydrated();
  const langReady = useLanguageHydrated();
  const prefsReady = useSplashPrefsHydrated();
  const forced = useSplashPrefs(s => s.edition);
  const enabled = useSplashPrefs(s => s.enabled && !s.plain);
  const language = useLanguageStore(s => s.language);
  const lang: 'tr' | 'en' = language in GREET ? (language as 'tr' | 'en') : 'en';
  const c = GREET[lang];
  const greet = useMemo(() => c.greet(new Date().getHours()), [c]);
  /* Açılış başına bir sürüm. */
  // Admin bir sürüm sabitlediyse o; yoksa rastgele (bkz. useSplashPrefs).
  const edition = useMemo(
    () => EDITIONS.find(e => e.id === forced) ?? EDITIONS[Math.floor(Math.random() * EDITIONS.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefsReady],
  );
  const wordsOf = edition.words[lang];

  /** Devralınan renk: sistem splash'i ne çizdiyse o. */
  const systemBg = systemScheme === 'dark' ? Colors.dark.background : Colors.light.background;
  /** Varılan renk: uygulamanın kendi teması (tercih + sistem). */
  const isDark = colorScheme === 'dark';
  const bg = isDark ? Colors.dark.background : Colors.light.background;
  const needsBridge = bg !== systemBg;
  const ink = isDark ? Colors.dark.onBackground : Colors.light.onBackground;
  const muted = isDark ? Colors.dark.onSurfaceMuted : Colors.light.onSurfaceMuted;
  /** Sürümün rengi — küratörlü sabit set, kişisel vurgudan bağımsız. */
  const brand = isDark ? edition.color.dark : edition.color.light;
  const track = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  /*
    ÖLÇÜ EKRANDAN TÜRER — küçük telefondan tablete:
      · yazı genişliğin %11.5'i (34–64); blok İÇERİĞİ kadar geniş ve yatayda ortalı (sola yaslı sütun sağı boş bırakıyordu);
      · kuşaklar ekran dışından ekran dışına uzanır, genişlikleri ekranın %12'si (36–72);
      · biri üst, biri alt bölgede, sözcükler ortada — birbirini örtmez.
  */
  const fontSize = Math.round(Math.min(64, Math.max(34, width * 0.115)));
  const glyph = Math.round(fontSize * 0.62);
  const ribbonW = Math.round(Math.min(72, Math.max(36, width * 0.12)));
  /* Düzen sürüme göre aynalanır: kuşaklar bazen soldan, bazen sağdan gelir. */
  const L0 = -width * 0.15, R0 = width * 1.15;
  const pathA: RibbonPath = edition.mirror
    ? { x0: R0, y0: height * 0.25, x1: L0, y1: height * 0.13, amp: height * 0.025, waves: 0.85, twists: 1.35, width: ribbonW }
    : { x0: L0, y0: height * 0.25, x1: R0, y1: height * 0.13, amp: height * 0.025, waves: 0.85, twists: 1.25, width: ribbonW };
  const pathB: RibbonPath = edition.mirror
    ? { x0: L0, y0: height * 0.79, x1: R0, y1: height * 0.88, amp: height * 0.022, waves: 0.75, twists: 1.0, width: ribbonW }
    : { x0: R0, y0: height * 0.79, x1: L0, y1: height * 0.88, amp: height * 0.022, waves: 0.75, twists: 1.1, width: ribbonW };
  /*
    İmza: mürekkep genişliğin %22'si (tavanlı), alt kuşağın altında; mürekkebin altı ekranın
    dibinden %4.5 yukarıda. Logo ekranın ortasından (sistem splash'inin yeri) buraya kayar.
    Kap yüksekliği yerleşimden ölçülür: sistem splash'i TAM ekranın ortasına çizer.
  */
  const [boxH, setBoxH] = React.useState(height);
  const onBoxLayout = (e: LayoutChangeEvent) => setBoxH(e.nativeEvent.layout.height);
  const markWidth = Math.min(width * 0.245, 122);
  const signScale = markWidth / (NATIVE_LOGO * NATIVE_INK_W);
  const signInkH = NATIVE_LOGO * NATIVE_INK_H * signScale;
  // Mürekkep merkezinin resim merkezinden aşağı kayması (ölçek merkezden uygulanır, kayma da ölçeklenir).
  const inkOffset = ((NATIVE_INK_TOP - NATIVE_INK_BOTTOM) / 2) * NATIVE_LOGO;
  // Android tuş çubuğu gizlenemezse (eski kurulum, üretici) imza tuşların altında kalmasın (Samsung M31s, 2026-11-06).
  const signBottom = Math.max(boxH * 0.045, Platform.OS === 'android' ? (initialWindowMetrics?.insets.bottom ?? 0) + 8 : 0);
  const signY = Math.round(boxH - signBottom - signInkH / 2 - boxH / 2 - inkOffset * signScale);
  const rgbA = rgbOf(brand);
  const rgbB = rgbOf(ink);

  const [introDone, setIntroDone] = React.useState(false);
  /*
    ÇIKIŞ UI İŞ PARÇACIĞINDA PLANLANIR. Uygulama ağacı açılışın ALTINDA kurulurken JS iş parçacığı
    saniyelerce meşgul olabiliyor; çıkış bir JS zamanlayıcısına bağlıyken açılış Android'de ~12 sn
    ekranda kaldı (ölçüldü). Artık giriş başladığı an (ve hazır olduğu an) kalan süre hesaplanıp
    çıkış Reanimated gecikmesiyle UI'da kurulur; JS geç kalsa da açılış tam zamanında söner.
  */
  const introStart = React.useRef(0);
  const outroStarted = React.useRef(false);
  const bridge = useSharedValue(needsBridge ? 0 : 1);
  /** 0 sistem logosu, 1 uygulamanın logosu. Kapanıma bağlı değil: tema geç okununca stil eski değerle kalıyor, koyu temada siyah logo görünüyordu (iPad, 2026-11-06). */
  const logoMix = useSharedValue(0);
  const headA = useSharedValue(reduceMotion ? 1 : 0);
  const headB = useSharedValue(reduceMotion ? 1 : 0);
  const tailA = useSharedValue(0);
  const tailB = useSharedValue(0);
  const phase = useSharedValue(0);
  const w0 = useSharedValue(reduceMotion ? 1 : 0);
  const w1 = useSharedValue(reduceMotion ? 1 : 0);
  const w2 = useSharedValue(reduceMotion ? 1 : 0);
  const d0 = useSharedValue(reduceMotion ? 1 : 0);
  const d1 = useSharedValue(reduceMotion ? 1 : 0);
  const d2 = useSharedValue(reduceMotion ? 1 : 0);
  const words = [w0, w1, w2];
  const draws = [d0, d1, d2];
  const content = useSharedValue(1);
  const screen = useSharedValue(1);
  const glide = useSharedValue(0);
  // Nokta dokusu sistem splash'inde yok: bir anda belirmesin, logo kayarken gelsin.
  const dots = useSharedValue(0);
  const exitCue = useSharedValue(0);

  const shown = themeReady && langReady && prefsReady && canStart;

  // Zemin köprüsü: tema diskten okunur okunmaz, ekran hâlâ boşken.
  /*
    ZEMİN HER ZAMAN YAZIYLA AYNI TEMADA (2026-11-01, kullanıcı: "iPad'de tema aydınlık, splash koyu geldi, yazılar
    siyahtı — ciddi açık"). Yazı rengi uygulamanın temasından, zemin ise köprü katmanından geliyor; köprü bir
    sebeple 1'e varmazsa (ilk değer ilk karede donuyor, animasyon yeniden yüklemede düşebiliyor) koyu zeminde koyu
    yazı kalıyordu. Artık: tema okununca köprü kesin 1'e gider; animasyon düşerse süre sonunda doğrudan yazılır.
  */
  useEffect(() => {
    if (!themeReady) return;
    logoMix.value = needsBridge && !reduceMotion ? withTiming(1, { duration: BG_BRIDGE, easing: Easing.inOut(Easing.quad) }) : 1;
    if (!needsBridge || reduceMotion) { bridge.value = 1; return; }
    bridge.value = withTiming(1, { duration: BG_BRIDGE, easing: Easing.inOut(Easing.quad) });
    const t = setTimeout(() => { bridge.value = 1; }, BG_BRIDGE + 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsBridge, themeReady, reduceMotion, bg]);

  const startOutro = (delay: number) => {
    if (outroStarted.current) return;
    outroStarted.current = true;
    const accel = Easing.in(Easing.cubic);
    if (onExitStart) exitCue.value = withDelay(delay, withTiming(1, { duration: 1 }, done => { if (done) runOnJS(onExitStart)(); }));
    if (!reduceMotion) {
      // Kuşaklar kendi yolunda akıp gider (kuyruk ucu kovalar).
      tailA.value = withDelay(delay, withTiming(1, { duration: OUTRO, easing: accel }));
      tailB.value = withDelay(delay, withTiming(1, { duration: OUTRO, easing: accel }));
      content.value = withDelay(delay, withTiming(0, { duration: OUTRO * 0.7, easing: accel }));
    }
    screen.value = withDelay(delay + (reduceMotion ? 0 : OUTRO * 0.4), withTiming(0, { duration: reduceMotion ? 120 : OUTRO * 0.6, easing: accel }, done => {
      if (done) runOnJS(onFinish)();
    }));
  };

  // Giriş: tema VE dil okunduktan sonra.
  useEffect(() => {
    if (!shown) return;
    onReady();
    dots.value = withTiming(1, { duration: reduceMotion ? 0 : GLIDE });
    // Hareketi Azalt: her şey yerinde. Admin açılışı kapattıysa: hiçbir şey çizilmez, hazır olunca geçilir.
    // İkisinde de logo sistem splash'indeki yerinde kalır ve ekranla birlikte söner.
    if (reduceMotion || !enabled) {
      setIntroDone(true);
      return;
    }
    glide.value = withDelay(GLIDE_DELAY, withTiming(1, { duration: GLIDE, easing: Easing.out(Easing.cubic) }));
    // Kuşaklar açılarak gelir (uç yol boyunca ilerler); dalga ve bükülme süre boyunca akar.
    headA.value = withSpring(1, RIBBON_SPRING);
    headB.value = withDelay(RIBBON_B_DELAY, withSpring(1, RIBBON_SPRING));
    // Dalga sönümlenerek durur: kumaş yerine oturur, sonra çıkış başlar.
    phase.value = withTiming(1.8, { duration: INTRO_TOTAL, easing: Easing.out(Easing.cubic) });
    const drawEase = Easing.inOut(Easing.cubic);
    words.forEach((w, i) => { w.value = withDelay(240 + i * WORD_STEP, withSpring(1, WORD_SPRING)); });
    draws.forEach((d, i) => { d.value = withDelay(330 + i * WORD_STEP, withTiming(1, { duration: GLYPH_DRAW, easing: drawEase })); });
    // Dokunsal koreografi hareketle senkron: kuşak oturur · sözcükler · tik (bkz. haptic.splash).
    const stopHaptics = haptic.splash([
      { at: 360, kind: 'soft' },
      { at: 240 + WORD_STEP + 120, kind: 'tick' },
      { at: 240 + 2 * WORD_STEP + 120, kind: 'tick' },
      { at: 330 + 2 * WORD_STEP + GLYPH_DRAW * 0.8, kind: 'firm' },
    ]);
    introStart.current = Date.now();
    // Hazırsa çıkış ŞİMDİ UI'da planlanır (JS meşgul olsa da zamanında); değilse hazır olunca.
    if (ready) startOutro(INTRO_TOTAL);
    const doneTimer = setTimeout(() => setIntroDone(true), INTRO_TOTAL);
    return () => { stopHaptics(); clearTimeout(doneTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduceMotion]);

  // Çıkış — uygulama hazır olunca: girişten kalan süre kadar bekleyip (UI'da) kuşaklar fırlar, ekran söner.
  useEffect(() => {
    if (!ready || outroStarted.current) return;
    if (!introDone && !introStart.current) return; // giriş henüz başlamadı (tema/dil okunuyor)
    const left = introDone ? 0 : Math.max(0, INTRO_TOTAL - (Date.now() - introStart.current));
    startOutro(left);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introDone, ready, reduceMotion]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  const bridgeStyle = useAnimatedStyle(() => ({ opacity: bridge.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ scale: 0.97 + content.value * 0.03 }] }));
  const greetStyle = useAnimatedStyle(() => ({ opacity: w0.value }));
  // Logo sistem splash'inin yerinden imzaya kayar; çıkışta içerikle söner.
  const signStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: glide.value * signY }, { scale: 1 + glide.value * (signScale - 1) }],
  }));
  // Sistem logosu (sistem temasının rengi) uygulamanın temasına zemin köprüsüyle birlikte geçer.
  const systemLogoStyle = useAnimatedStyle(() => ({ opacity: 1 - logoMix.value }));
  const appLogoStyle = useAnimatedStyle(() => ({ opacity: logoMix.value }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dots.value }));
  const systemLogo = systemScheme === 'dark' ? NATIVE_LOGO_WHITE : NATIVE_LOGO_DARK;
  const appLogo = isDark ? NATIVE_LOGO_WHITE : NATIVE_LOGO_DARK;

  return (
    // Tema okununca kabın KENDİ zemini de uygulamanın temasına geçer (köprü katmanına bağlı kalmadan) — iPad'de
    // köprü üstte görünmediğinde koyu zemin + açık tema yazısı kalıyordu (2026-11-01, ikinci rapor).
    <Animated.View onLayout={onBoxLayout} style={[styles.container, { backgroundColor: themeReady && shown ? bg : systemBg }, screenStyle]}>
      {/* Uygulamanın rengi: sistem renginin üstünde açılır (zemin köprüsü). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg }, bridgeStyle]} />

      {/* Ana ekranın kendi zemin dokusu — değerler BİREBİR aynı (bkz. app/index.tsx). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dotsStyle]}>
        <DottedBackground
          color={isDark ? Colors.dark.onBackground : Colors.light.onBackground}
          opacity={isDark ? 0.05 : 0.08}
          size={24}
          dotSize={1}
        />
      </Animated.View>

      {/*
        Süs kuşakları — yazısız, 3B ışıklı ipek (bkz. SilkRibbon). Tuval EN BAŞTAN kurulur (kuşaklar
        görünmez: uç = 0): Android'de Skia yüzeyinin ilk karesi geç geliyor, tema/dil okununca kurulunca
        sözcükler gelmiş ama kuşaklar henüz yoktu (cihazda).
      */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <SilkRibbon path={pathA} rgb={rgbA} head={headA} tail={tailA} phase={phase} lowPower={lowPower} />
        <SilkRibbon path={pathB} rgb={rgbB} head={headB} tail={tailB} phase={phase} lowPower={lowPower} shadow={isDark ? 0.4 : 0.22} />
      </Canvas>
      {shown && enabled && (
        <>

          <Animated.View style={[{ alignSelf: 'center', maxWidth: Math.min(width * 0.88, 560), gap: Math.round(fontSize * 0.16) }, contentStyle]}
            accessible accessibilityLabel={`${greet}. ${wordsOf.join('. ')}.`}>
            <Animated.Text allowFontScaling={false} style={[{ fontSize: Math.round(fontSize * 0.26), fontWeight: '700', letterSpacing: fontSize * 0.04, color: muted, marginBottom: Math.round(fontSize * 0.12) }, greetStyle]}>
              {greet.toLocaleUpperCase(c.locale)}
            </Animated.Text>
            {wordsOf.map((w, i) => (
              <WordRow key={w} word={w} kind={edition.glyphs[i]} fontSize={fontSize} glyph={glyph} ink={ink} brand={brand} track={track} enter={words[i]} draw={draws[i]} />
            ))}
          </Animated.View>

        </>
      )}

      {/*
        İMZA — ilk karede sistem splash'inin logosuyla AYNI yer ve boyut (ekranın ortası, 100 dp kare),
        sonra alt kuşağın altına kayar. Koşulsuz çizilir: tema/dil okunurken de ekranda kalır.
      */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.signLayer]}>
        <Animated.View style={[styles.sign, signStyle]}>
          <Animated.Image source={systemLogo} style={[styles.signImage, systemLogoStyle]} />
          <Animated.Image source={appLogo} style={[styles.signImage, appLogoStyle]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signLayer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sign: {
    width: NATIVE_LOGO,
    height: NATIVE_LOGO,
  },
  signImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: NATIVE_LOGO,
    height: NATIVE_LOGO,
  },
});

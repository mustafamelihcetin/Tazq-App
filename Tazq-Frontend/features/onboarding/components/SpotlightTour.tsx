import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, BackHandler, AccessibilityInfo, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { X } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useTour, type ScrollLike } from '@/shared/components/TourContext';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';
import { S, R, F, W, ICON, MIN_TOUCH, HAIRLINE, topBarSpace, navBarSpace, touchSlop } from '@/shared/constants/tokens';
import { TOUR_STEPS, type TourStepDef } from '@/features/onboarding/tour/tourSteps';
import { spotRect, holePath, placeTip, placeTipX, type Rect } from '@/features/onboarding/tour/spotlightGeometry';
import type { FirstRunPage } from '@/features/onboarding/utils/firstRun';

/*
  ── VURGULAMALI TUR — gerçek ekranı anlatır ───────────────────────────────────────
  Eski tur tam ekran bir örtüye SAHTE önizleme çiziyordu (cihazda: gece "Günaydın,
  Deniz · 84"). Standart kütüphanelerin hepsi aynı şeyi yapar: GERÇEK öğe vurgulanır.
    · driver.js / react-native-copilot / shepherd → ekran kararır, öğe delikten görünür
    · copilot `svg` örtüsü → delik tek SVG yolu (evenodd); dört dikdörtgen Android'de
      animasyonda takılıyor (kütüphanenin kendi notu)
    · react-joyride → "2 / 5" ilerleme, Geri/İleri, TEK atla; ESC (Android geri) bir adım geri
    · shepherd → diyalog erişilebilirliği (modal, adım duyurusu)

  BALON platformun kendi diliyle (kullanıcı: "gerekirse iOS ve Android ayrı"):
    · iOS → Apple TipKit popover: 16pt köşe, başlık + ikincil mesaj, sağ üstte kapat (×), dolu kapsül eylem
    · Android → M3 Rich tooltip: tonal yüzey, 12dp köşe, metin düğmeleri, "Atla" eylemi
  Ölçüler ekrandan türer (telefon → tablet, döndürme): bkz. spotlightGeometry + test.
*/

const AnimatedPath = Animated.createAnimatedComponent(Path);
const IS_IOS = Platform.OS === 'ios';

// Delik payı ve köşesi HEDEFTEN gelir (TourTarget spotPad / spotRadius): kartta pay 0 ve
// köşe kartın köşesi → delik kartın kenarına birebir oturur. Eskiden sabit 8 pay + R.lg
// köşe kartın çevresinde gri bir çerçeve ve uyumsuz iki eğri bırakıyordu (cihazda görüldü).
const GAP = 12;         // delik ↔ balon
const MARGIN = S.md;    // balon ↔ ekran kenarı
const TIP_MAX_W = 360;  // tablette balon hedefin yanında kalır, ekranı kaplamaz
const TIP_R = IS_IOS ? R.lg : R.md; // TipKit ~16 · M3 rich tooltip 12dp
const ARROW = 10;

const COPY = {
  tr: { next: 'İleri', back: 'Geri', done: 'Anladım', skip: 'Atla', close: 'Turu kapat', of: (i: number, n: number) => `${i} / ${n}`, a11yStep: (i: number, n: number) => `Adım ${i} / ${n}` },
  en: { next: 'Next', back: 'Back', done: 'Got it', skip: 'Skip', close: 'Close tour', of: (i: number, n: number) => `${i} / ${n}`, a11yStep: (i: number, n: number) => `Step ${i} of ${n}` },
};

interface Props {
  pageId: FirstRunPage;
  /** Sayfanın kaydırma görünümü — hedef ekran dışındaysa oraya kaydırılır. */
  scrollRef?: React.RefObject<ScrollLike | null>;
  onDone: () => void;
}

export function SpotlightTour({ pageId, scrollRef, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { theme, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { language } = useLanguageStore();
  const c = COPY[language === 'en' ? 'en' : 'tr'];
  const { measureTarget, scrollTargetIntoView } = useTour();

  /*
    KOORDİNAT KÖKENİ — örtünün KENDİ penceredeki yeri ve boyutu.
    Hedefler measureInWindow ile ölçülür; örtü de aynı yöntemle ölçülüp ondan çıkarılır.
    useWindowDimensions'a güvenmek kayma demekti: Android'de pencere yüksekliği durum
    çubuğunu bazen içeriyor bazen içermiyor (kenardan kenara, sürüm, üretici). Aynı
    koordinat sisteminde çıkarma yapınca platform ne derse desin fark sıfır.
  */
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const onRootLayout = () => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setFrame({ x, y, width, height });
    });
  };
  const sw = frame?.width ?? winW;
  const sh = frame?.height ?? winH;

  const steps: TourStepDef[] = TOUR_STEPS[pageId] ?? [];
  // Gösterilebilen adımlar: hedefi o an ekranda olmayan adım atlanır (Sade mod, boş liste…).
  const [shown, setShown] = useState<boolean[]>(() => steps.map(() => true));
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [holeRadius, setHoleRadius] = useState(0);
  const [holeCorners, setHoleCorners] = useState<'all' | 'top' | 'bottom'>('all');
  const [tipH, setTipH] = useState(0);
  const dirRef = useRef(1);

  // Delik: tam ekrandan başlar (açılış = kararma), sonra hedefe daralır.
  const hx = useSharedValue(winW / 2), hy = useSharedValue(winH / 2), hw = useSharedValue(0), hh = useSharedValue(0), hr = useSharedValue(0);
  const scr = { width: sw, height: sh };
  const animatedProps = useAnimatedProps(() => ({
    d: holePath({ x: hx.value, y: hy.value, width: hw.value, height: hh.value }, hr.value, scr, holeCorners),
  }));

  const visibleSteps = steps.filter((_, i) => shown[i]);
  const visiblePos = visibleSteps.indexOf(steps[index]) + 1;

  /** Adımı göster: hedefi görünür yap → ölç → deliği oraya taşı. */
  const goTo = useCallback(async (i: number) => {
    const step = steps[i];
    if (!step) { onDone(); return; }
    setHole(null);
    // Kaydırma görünümü ekranın tepesinden başlar (başlık üstte yüzer): hedef başlık çubuğunun altına gelsin.
    if (step.scrollTop) {
      // Başlık hedefi: sayfa en üste, başlığın logo↔selamlama geçişi (opaklık) bitene kadar
      // beklenir — ölçüm aynı kalsa da öğe henüz görünür olmayabilir.
      scrollRef?.current?.scrollTo({ y: 0, animated: !reduceMotion });
      await new Promise((r) => setTimeout(r, reduceMotion ? 120 : 520));
    } else {
      await scrollTargetIntoView(step.target, scrollRef?.current, topBarSpace(insets.top) + S.md);
    }
    /*
      DURGUN ÖLÇÜM — sabit bir bekleme değil. Kaydırma, giriş animasyonu ya da tur
      başlayınca beliren örnek veri hedefi hâlâ oynatıyor olabilir; o anda ölçmek kayma
      demek. Ardışık iki ölçüm birebir aynı olana kadar tekrar ölçülür (en fazla ~1.5 sn).
    */
    let rect: Awaited<ReturnType<typeof measureTarget>> = null;
    for (let tries = 0; tries < 20; tries++) {
      await new Promise((r) => setTimeout(r, 75));
      const m = await measureTarget(step.target);
      const same = m && rect && m.x === rect.x && m.y === rect.y && m.width === rect.width && m.height === rect.height;
      rect = m;
      if (same) break;
    }
    if (!rect) {
      // Hedef yok → bu adımı gizle ve aynı yönde devam et.
      setShown((prev) => prev.map((v, k) => (k === i ? false : v)));
      const nextI = i + dirRef.current;
      if (nextI < 0 || nextI >= steps.length) { onDone(); return; }
      setIndex(nextI);
      return;
    }
    // Örtünün kökenine göre (bkz. frame) — aynı koordinat sistemi, sıfır fark.
    const ox = frame?.x ?? 0, oy = frame?.y ?? 0;
    const local = { x: rect.x - ox, y: rect.y - oy, width: rect.width, height: rect.height };
    const r = spotRect(local, rect.pad, scr, { top: 0, bottom: 0 });
    // Eşmerkezli köşe: dış eğri = iç eğri + pay → iki eğri paralel, tek nesne gibi okunur.
    const radius = rect.radius + rect.pad;
    const cfg = { duration: reduceMotion ? 0 : 340, easing: Easing.out(Easing.cubic) };
    hx.value = withTiming(r.x, cfg); hy.value = withTiming(r.y, cfg);
    hw.value = withTiming(r.width, cfg); hh.value = withTiming(r.height, cfg);
    hr.value = withTiming(radius, cfg);
    setHoleRadius(radius);
    setHoleCorners(rect.corners);
    setHole(r);
    const label = language === 'en' ? 'en' : 'tr';
    AccessibilityInfo.announceForAccessibility?.(`${step.title[label]}. ${step.body[label]}`);
  }, [steps, sw, sh, frame, insets.top, reduceMotion, language]);

  // Örtü ölçülmeden adım gösterilmez; döndürme/bölünmüş ekranda yeniden ölçülür.
  useEffect(() => { if (frame) void goTo(index); }, [index, frame]);
  useEffect(() => { onRootLayout(); }, [winW, winH]);

  const next = () => {
    haptic.select();
    dirRef.current = 1;
    let n = index + 1;
    while (n < steps.length && !shown[n]) n++;
    if (n >= steps.length) onDone(); else setIndex(n);
  };
  const back = () => {
    let p = index - 1;
    while (p >= 0 && !shown[p]) p--;
    if (p < 0) return false;
    haptic.select();
    dirRef.current = -1;
    setIndex(p);
    return true;
  };

  // Android geri tuşu: bir adım geri; ilk adımda turu kapatır (joyride dismissKeyAction).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!back()) onDone();
      return true;
    });
    return () => sub.remove();
  });

  const step = steps[index];
  const isLast = visiblePos === visibleSteps.length;
  const label = language === 'en' ? 'en' : 'tr';
  // Balon sekme çubuğunun altına girmez; deliğin altına/üstüne yerleşir.
  const band = { top: insets.top + S.sm, bottom: navBarSpace(insets.bottom) };
  const tipY = hole ? placeTip(hole, tipH || 140, scr, band, GAP + ARROW) : null;
  const tipX = hole ? placeTipX(hole, sw, MARGIN, TIP_MAX_W, TIP_R) : null;
  const scrim = IS_IOS ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.66)';

  return (
    <View ref={rootRef} onLayout={onRootLayout} collapsable={false} style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal pointerEvents="auto">
      {/* Örtü + delik. Dokunuşlar yutulur: tur sürerken arkadaki ekran tetiklenmez. */}
      <Svg width={sw} height={sh} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Son delik statik de verilir: tur yeniden çizilirse delik kapanmasın (bkz. androidParity.test). */}
        <AnimatedPath d={holePath(hole ?? { x: 0, y: 0, width: 0, height: 0 }, holeRadius, scr, holeCorners)} animatedProps={animatedProps} fill={scrim} fillRule="evenodd" />
      </Svg>

      {step && hole && tipY && tipX && (
        <MotiView
          key={`tip-${index}`}
          from={{ opacity: 0, translateY: reduceMotion ? 0 : (tipY.side === 'above' ? -6 : 6) }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: reduceMotion ? 0 : 220 }}
          onLayout={(e) => setTipH(e.nativeEvent.layout.height)}
          accessibilityRole="alert"
          // Opak yüzey: balon zaten koyu örtünün üstünde, cam bir şey katmıyor ve ok ile
          // ton farkı yaratıyordu. Koyu temada saç teli çerçeve kenarı söyler.
          style={[styles.tip, { left: tipX.x, top: tipY.y, width: tipX.width, borderRadius: TIP_R, backgroundColor: theme.surfaceCard, borderColor: theme.outline, borderWidth: isDark ? HAIRLINE : 0 }, !IS_IOS && { elevation: 6 }]}
        >
          {/* Ok — balonun hedef tarafında, hedefin ortasını gösterir. */}
          {tipY.side !== 'inside' && (
            <View
              pointerEvents="none"
              style={[
                styles.arrow,
                { left: tipX.arrowX - ARROW, backgroundColor: theme.surfaceCard },
                tipY.side === 'below' ? { top: -ARROW / 2 - 1 } : { bottom: -ARROW / 2 - 1 },
              ]}
            />
          )}

          <View style={styles.tipBody}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.onSurface }]} accessibilityRole="header">{step.title[label]}</Text>
              {IS_IOS && (
                // TipKit: kapat (×) sağ üstte. Android'de "Atla" metin düğmesi olarak eylem satırında.
                <Touchable onPress={onDone} hitSlop={touchSlop(ICON.sm)} accessibilityRole="button" accessibilityLabel={c.close}>
                  <X size={ICON.sm} color={theme.onSurfaceMuted} />
                </Touchable>
              )}
            </View>
            <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>{step.body[label]}</Text>

            <View style={styles.actions}>
              <Text style={[styles.progress, { color: theme.onSurfaceMuted }]} accessibilityLabel={c.a11yStep(visiblePos, visibleSteps.length)}>
                {c.of(visiblePos, visibleSteps.length)}
              </Text>
              <View style={{ flex: 1 }} />
              {!IS_IOS && !isLast && (
                <Touchable onPress={onDone} style={styles.textBtn} accessibilityRole="button" accessibilityLabel={c.close}>
                  <Text style={[styles.textBtnLabel, { color: theme.onSurfaceVariant }]}>{c.skip}</Text>
                </Touchable>
              )}
              {visiblePos > 1 && (
                <Touchable onPress={back} style={styles.textBtn} accessibilityRole="button">
                  <Text style={[styles.textBtnLabel, { color: theme.primary }]}>{c.back}</Text>
                </Touchable>
              )}
              <Touchable
                onPress={next}
                accessibilityRole="button"
                style={IS_IOS ? [styles.primaryBtn, { backgroundColor: theme.primary }] : styles.textBtn}
              >
                <Text style={[styles.textBtnLabel, { color: IS_IOS ? theme.onPrimary : theme.primary }]}>{isLast ? c.done : c.next}</Text>
              </Touchable>
            </View>
          </View>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Ekran içi katman: Android çizim sırası elevation'a göre (bkz. androidParity.test).
  root: { zIndex: 9990, elevation: 50 },
  tip: {
    position: 'absolute',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  arrow: { position: 'absolute', width: ARROW * 2, height: ARROW * 2, transform: [{ rotate: '45deg' }], borderRadius: R.xs },
  tipBody: { paddingHorizontal: S.md, paddingTop: S.smd, paddingBottom: S.sm, gap: S.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: F.subhead, fontWeight: W.semibold },
  body: { fontSize: F.body, lineHeight: F.body * 1.4 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: S.xs, gap: S.xs },
  progress: { fontSize: F.caption, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
  textBtn: { minHeight: MIN_TOUCH, paddingHorizontal: S.smd, alignItems: 'center', justifyContent: 'center' },
  textBtnLabel: { fontSize: F.body, fontWeight: W.semibold },
  primaryBtn: { minHeight: 34, paddingHorizontal: S.md, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginVertical: S.xs },
});

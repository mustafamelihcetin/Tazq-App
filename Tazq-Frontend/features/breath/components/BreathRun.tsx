import React, { useEffect, useRef, useState } from 'react';
import { View, Text, AccessibilityInfo, AppState, BackHandler, useWindowDimensions } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import Reanimated, { ZoomIn, Easing, cancelAnimation, runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Pause, Play, X, Volume2, VolumeX } from 'lucide-react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { BreathPalette } from '@/shared/constants/Colors';
import { S, R, F, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { swallow } from '@/shared/utils/swallow';
import { patternOf, phaseAt, cyclesFor, totalSec, type BreathId, type PhaseState } from '@/features/breath/patterns';
import { BREATH_COPY } from '@/features/breath/breathCopy';
import { cuePhase, hushBreathCues, preloadBreathCues, releaseBreathCues, type BreathSound } from '@/features/breath/breathCues';
import { BreathOrb } from '@/features/breath/components/BreathOrb';

const INK = '#FFFFFF';
const CHROME_MS = 3500;
const ORB_MAX = 400;
/** Kontrollerin kenardan uzaklığı: çentikten taşmasın, iki uçta eşit olsun. */
const BAND_MIN = 56;
const ORB_IN_MS = 800;
const ORB_SHARE = 0.46; // küçük ekranda altyazı ve kontrollere yer kalsın
const LEAD = 3; // "Hazırlan" geri sayımı (sn)
const KEEP_AWAKE_TAG = 'tazq-breath';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Çalışan seans. TEK SAAT: `t` (sn) doğrusal ilerler; küre, yazı, sayaç ve
 * titreşim/ses hep `phaseAt(t)`tan okunur — ayrı zamanlayıcılar birbirinden kaymaz.
 * Arka plana geçince duraklar (nefes rehberi görülmeden/duyulmadan sürmesin).
 */
export function BreathRun({ level$, lang, id, minutes, sound, theme, onSound, onEnd }: {
  /** Zeminin okuduğu nefes (bkz. BreathBackdrop). */
  level$?: SharedValue<number>;
  lang: 'tr' | 'en'; id: BreathId; minutes: number; sound: boolean; theme: BreathSound; onSound: () => void;
  /** elapsed: rehberli geçen saniye (hazırlık hariç); full: süre doldu mu */
  onEnd: (elapsed: number, full: boolean) => void;
}) {
  const c = BREATH_COPY[lang];
  const p = patternOf(id);
  const pal = BreathPalette[id];
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const band = Math.max(BAND_MIN, Math.max(insets.top, insets.bottom) + S.md);
  const orb = Math.min(width - S.sm * 2, ORB_MAX, height * ORB_SHARE);
  const cycles = cyclesFor(p, minutes);
  const total = totalSec(p, minutes);

  const t = useSharedValue(-LEAD);
  const level = useDerivedValue(() => (t.value < 0 ? 0 : phaseAt(p, t.value, cycles).level));
  useAnimatedReaction(() => level.value, (v) => { if (level$) level$.value = v; });
  const [now, setNow] = useState(-LEAD);
  /*
    KONTROLLER KAYBOLUR (kullanıcı: "daha meditasyonel"): seans başlayınca ekranda yalnız küre ve kelime kalır; dokununca döner, kendi kendine yine gider.
    Duraklatınca ve ekran okuyucuda kalır: görünmeyen düğmeye ulaşılamazdı.
  */
  const [chrome, setChrome] = useState(true);
  const [reader, setReader] = useState(false);
  useEffect(() => { AccessibilityInfo.isScreenReaderEnabled().then(setReader).catch((e: unknown) => swallow('breath.reader', e)); }, []);
  const [paused, setPaused] = useState(false);
  const lastKey = useRef<string | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const finish = () => onEnd(total, true);
  const run = () => {
    t.value = withTiming(total, { duration: Math.max(0, (total - t.value) * 1000), easing: Easing.linear }, (done) => {
      if (done) runOnJS(finish)();
    });
  };
  // Duraklatınca ses susar; devamda ses yarım fazı baştan çalmaz, sıradaki fazla gelir.
  const pause = () => { cancelAnimation(t); hushBreathCues(); setPaused(true); };
  const resume = () => { setPaused(false); run(); };

  // Yarım saniyelik çözünürlük: rezonans fazları 5.5 sn'de döner.
  const sync = (v: number) => {
    setNow(v);
    if (v < 0) return;
    const st = phaseAt(p, v, cycles);
    const key = `${st.cycle}:${st.index}`;
    if (key !== lastKey.current && !st.done) { lastKey.current = key; cuePhase(st.kind, p.phases[st.index].sec, soundRef.current ? theme : null); }
  };
  useAnimatedReaction(() => Math.floor(t.value * 2), (k, prev) => { if (k !== prev) runOnJS(sync)(t.value); });

  // Geri tuşu = Bitir (X ile aynı): geçen süre korunur.
  const elapsedRef = useRef(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onEnd(elapsedRef.current, false); return true; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    preloadBreathCues(p, theme);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e: unknown) => swallow('breath.keepAwake', e));
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') pause(); });
    return () => {
      sub.remove();
      cancelAnimation(t);
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      releaseBreathCues();
    };
  }, []);

  const showChrome = chrome || paused || reader;
  useEffect(() => {
    if (!chrome || paused || reader) return;
    const id2 = setTimeout(() => setChrome(false), CHROME_MS);
    return () => clearTimeout(id2);
  }, [chrome, paused, reader]);

  const st: PhaseState | null = now < 0 ? null : phaseAt(p, now, cycles);
  const label = paused ? c.paused : st ? c.phase[st.kind] : c.ready;
  const count = st ? st.left : Math.ceil(-now);
  const elapsed = Math.max(0, now);
  elapsedRef.current = elapsed;

  /*
    SAHNE DÜZENİ (kullanıcı, iOS: "ekranın alt kısmını kullanmadı, boş kaldı"). Kontroller gizliyken de yer tutuyor, küreyi yukarı itiyordu.
    Artık küre ekranın tam ortasında, kelime altyazı gibi alt bölgede; kontroller hiç yer kaplamadan üste biner, gidip gelince hiçbir şey kaymaz.
  */
  const chromeFade = { type: 'timing' as const, duration: 700 };
  return (
    <View style={{ flex: 1 }}>
      <Touchable accessible={false} activeOpacity={1} onPress={() => setChrome(v => !v)} style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1 }} />
        {/* Seçicideki küre büyüyerek sahneye yürür: yeni ekran değil, aynı an. */}
        <Reanimated.View entering={ZoomIn.duration(ORB_IN_MS)}>
          <BreathOrb id={id} size={orb} level={level} />
        </Reanimated.View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: band + MIN_TOUCH }} accessibilityLiveRegion="polite">
          <AnimatePresence exitBeforeEnter>
            <MotiView key={label} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: -6 }} transition={{ type: 'timing', duration: 320 }} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: F.display, fontWeight: W.semibold, color: pal.accent, letterSpacing: 0.5 }}>{label}</Text>
            </MotiView>
          </AnimatePresence>
          {!paused && <Text style={{ fontSize: F.title3, color: 'rgba(255,255,255,0.55)', marginTop: S.xs, fontVariant: ['tabular-nums'] }}>{count}</Text>}
        </View>
      </Touchable>

      <MotiView pointerEvents={showChrome ? 'auto' : 'none'} animate={{ opacity: showChrome ? 1 : 0 }} transition={chromeFade} style={{ position: 'absolute', top: band, left: S.sm, right: S.sm, flexDirection: 'row', alignItems: 'center' }}>
        <Touchable onPress={() => onEnd(elapsed, false)} accessibilityRole="button" accessibilityLabel={c.stop} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
          <X size={ICON.lg} color={INK} />
        </Touchable>
        <Text accessibilityLabel={c.left(mmss(total - elapsed))} style={{ flex: 1, textAlign: 'center', fontSize: F.body, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] }}>{mmss(total - elapsed)}</Text>
        <Touchable onPress={onSound} accessibilityRole="switch" accessibilityState={{ checked: sound }} accessibilityLabel={c.sound} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
          {sound ? <Volume2 size={ICON.md} color={INK} /> : <VolumeX size={ICON.md} color="rgba(255,255,255,0.5)" />}
        </Touchable>
      </MotiView>

      <MotiView pointerEvents={showChrome ? 'auto' : 'none'} animate={{ opacity: showChrome ? 1 : 0 }} transition={chromeFade} style={{ position: 'absolute', bottom: band, left: S.sm, right: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Touchable onPress={paused ? resume : pause} accessibilityRole="button" accessibilityLabel={paused ? c.resume : c.pause} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
          {paused ? <Play size={ICON.lg} color={INK} /> : <Pause size={ICON.lg} color={INK} />}
        </Touchable>
        <View style={{ flex: 1, height: 3, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (elapsed / total) * 100)}%`, height: '100%', backgroundColor: pal.accent }} />
        </View>
      </MotiView>
    </View>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { haptic } from '@/shared/utils/haptics';
import { F, S, RSPRING } from '@/shared/constants/tokens';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/*
  SÜRE KADRANI — süre HALKANIN KENDİSİNDEN seçilir (2026-11-01, kullanıcı: "özel sürede 3 dakikayı seçemiyorum").
  2026-11-05 yeniden kuruldu (kullanıcı: "süre mekaniği tam kalitede değil"). Eski kadranda: halkanın uzağından sürüklemeye başlayınca değer parmağa sıçrıyordu, hızlı çevirince mutlak konum yüzünden 1'e düşebiliyordu, her dakika titriyordu, takip JS'te olduğu için takılıyordu.
  Şimdi:
   · GÖRELİ: halkanın neresinden tutarsan tut, değer parmağın KAT ETTİĞİ açı kadar değişir. Sıçrama yok, ucundan taşma yok, tur atlama yok.
   · HIZA DUYARLI: yavaş çevir 1 dakika (3 dakikayı seçebilirsin), hızlı çevir 5 dakika.
   · MIKNATIS: 15, 25, 30, 45, 60, 90 hafifçe tutar ve belirgin tık verir; dokununca o noktaya gider.
   · AKICI: halka ve tutamaç arayüz iş parçacığında çizilir, JS yoğunken de parmağı izler. Sayı ve titreşim JS'te.
   · BİLGİ: sürüklerken bitiş saati görünür: "25 dakika" değil, "ne zaman biterim".
  Ortadaki dokunuşlar (görev seçimi) kadranı tetiklemez: yalnız halka bandında başlayan hareket sayılır.
*/
export const DIAL_MAX = 120;
export const DIAL_MIN = 1;
/** Son durak: halka dolduktan sonra parmak ilerlemeye devam ederse "Serbest" (yeni düğme yok). */
export const DIAL_OPEN = 121;
export const DIAL_OPEN_POS = 126;
/** Bu hızın üstünde (dakika/sn) adım 5'e çıkar. Yaklaşık 2 tam parmak kayması/sn. */
const FAST_MIN_PER_SEC = 70;
const COARSE_STEP = 5;
const STOPS = [15, 25, 30, 45, 60, 90];
const MAGNET = 0.8;
/** Bu kadar kaymadıysa dokunuştur, sürükleme değil (pt). */
const TAP_SLOP = 6;
const LABELS = [30, 60, 90, 120];

const COPY = {
  tr: { unit: 'DAKİKA', ends: (t: string) => `Bitiş ${t}`, locale: 'tr-TR', open: 'Serbest', openHint: 'Sen bitirene kadar', moreHint: 'Serbest için devam et' },
  en: { unit: 'MINUTES', ends: (t: string) => `Ends ${t}`, locale: 'en-US', open: 'Open', openHint: 'Until you finish', moreHint: 'Keep going for Open' },
};

/** Tepeden saat yönüne açı (radyan, 0..2π). */
export function angleOf(x: number, y: number, size: number): number {
  'worklet';
  const c = size / 2;
  const a = Math.atan2(x - c, -(y - c));
  return a < 0 ? a + Math.PI * 2 : a;
}

export function minutesFromPoint(x: number, y: number, size: number): number {
  'worklet';
  return Math.round((angleOf(x, y, size) / (Math.PI * 2)) * DIAL_MAX);
}

/** Parmağın kat ettiği açıyı dakikaya çevirir. En kısa yön: tepeden geçmek sıçrama değildir. */
export function advance(pos: number, prevAngle: number, angle: number, max: number = DIAL_MAX): number {
  'worklet';
  let d = angle - prevAngle;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.min(max, Math.max(DIAL_MIN, pos + (d / (Math.PI * 2)) * DIAL_MAX));
}

/** Görünen değer: yavaşta dakika + mıknatıs, hızlıda 5'lik. */
export function snapMinutes(pos: number, fast: boolean): number {
  'worklet';
  if (pos >= DIAL_OPEN_POS - 0.5) return DIAL_OPEN;
  if (fast) return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(pos / COARSE_STEP) * COARSE_STEP));
  for (let i = 0; i < STOPS.length; i++) if (Math.abs(pos - STOPS[i]) < MAGNET) return STOPS[i];
  return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(pos)));
}

export const isStop = (m: number) => STOPS.includes(m);

/** Yol nesnesi yalnız gerçek Skia ortamında kurulur: Canvas'ın İÇİNDE. */
function Ring({ size, r, frac, grab, color }: { size: number; r: number; frac: SharedValue<number>; grab: SharedValue<number>; color: string }) {
  const c = size / 2;
  const path = useMemo(() => Skia.PathBuilder.Make().addArc({ x: c - r, y: c - r, width: r * 2, height: r * 2 }, -90, 359.9).build(), [c, r]);
  const end = useDerivedValue(() => frac.value);
  const kx = useDerivedValue(() => c + r * Math.sin(frac.value * Math.PI * 2));
  const ky = useDerivedValue(() => c - r * Math.cos(frac.value * Math.PI * 2));
  const halo = useDerivedValue(() => 13 + grab.value * 7);
  return (
    <>
      <Path path={path} style="stroke" strokeWidth={8} strokeCap="round" color={color} start={0} end={end} />
      <Circle cx={kx} cy={ky} r={halo} color={color} opacity={0.28} />
      <Circle cx={kx} cy={ky} r={9} color="#FFFFFF" />
    </>
  );
}

export function DurationDial({ size, minutes, color, track, onCommit, onDragging, a11yLabel, language }: {
  size: number; minutes: number; color: string; track: string;
  /** Parmak kalkınca seçilen değer (depoya yazılır). */
  onCommit: (m: number) => void;
  /** Sürükleme başladı/bitti: ekran bu sürede kendi sayacını gizler, sayıyı kadran çizer. */
  onDragging?: (on: boolean) => void;
  a11yLabel: string;
  language: 'tr' | 'en';
}) {
  const reduce = useReduceMotion();
  const c0 = COPY[language];
  const [live, setLive] = useState(minutes);
  const [dragging, setDragging] = useState(false);
  const shown = useRef(minutes);

  const r = size / 2 - 6;
  const c = size / 2;

  const frac = useSharedValue(Math.min(minutes, DIAL_MAX) / DIAL_MAX);
  const grab = useSharedValue(0);
  const pos = useSharedValue(minutes);
  const value = useSharedValue(minutes);
  const prevAngle = useSharedValue(0);
  const prevTime = useSharedValue(0);
  const speed = useSharedValue(0);
  const travel = useSharedValue(0);
  const active = useSharedValue(false);

  useEffect(() => {
    if (dragging) return;
    setLive(minutes);
    shown.current = minutes;
    pos.value = minutes === DIAL_OPEN ? DIAL_OPEN_POS : minutes;
    value.value = minutes;
    frac.value = reduce ? Math.min(minutes, DIAL_MAX) / DIAL_MAX : withTiming(Math.min(minutes, DIAL_MAX) / DIAL_MAX, { duration: 200 });
  }, [minutes, dragging, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => { setDragging(true); onDragging?.(true); haptic.surface(); };
  const tick = (m: number, pinned: boolean) => {
    shown.current = m;
    setLive(m);
    if (pinned) haptic.commit();
    else if (isStop(m)) haptic.surface();
    else haptic.select();
  };
  const finish = (m: number) => {
    setDragging(false);
    onDragging?.(false);
    if (m !== minutes) onCommit(m);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      const d = Math.hypot(e.x - c, e.y - c);
      active.value = d > r * 0.62 && d < r + 22;
      if (!active.value) return;
      prevAngle.value = angleOf(e.x, e.y, size);
      prevTime.value = Date.now();
      speed.value = 0;
      travel.value = 0;
      pos.value = value.value === DIAL_OPEN ? DIAL_OPEN_POS : value.value;
      grab.value = withSpring(1, RSPRING.snappy);
      runOnJS(begin)();
    })
    .onUpdate(e => {
      if (!active.value) return;
      travel.value = Math.max(travel.value, Math.hypot(e.translationX, e.translationY));
      if (travel.value < TAP_SLOP) return;
      const a = angleOf(e.x, e.y, size);
      const next = advance(pos.value, prevAngle.value, a, DIAL_OPEN_POS);
      const now = Date.now();
      const dt = Math.max(1, now - prevTime.value);
      // Yumuşatılmış hız: tek titrek karede adım değişmesin.
      speed.value = speed.value * 0.7 + (Math.abs(next - pos.value) / dt) * 1000 * 0.3;
      prevAngle.value = a;
      prevTime.value = now;
      pos.value = next;
      frac.value = Math.min(next, DIAL_MAX) / DIAL_MAX;
      const m = snapMinutes(next, speed.value > FAST_MIN_PER_SEC);
      if (m !== value.value) {
        value.value = m;
        runOnJS(tick)(m, m === DIAL_MAX || m === DIAL_MIN || m === DIAL_OPEN);
      }
    })
    .onFinalize(e => {
      if (!active.value) return;
      active.value = false;
      grab.value = withSpring(0, RSPRING.snappy);
      // Dokunuş: o noktaya gider (mıknatısla). Sürükleme: tutamaç seçilen değere oturur.
      const m = travel.value < TAP_SLOP ? Math.max(DIAL_MIN, snapMinutes(minutesFromPoint(e.x, e.y, size) || DIAL_MAX, false)) : value.value;
      value.value = m;
      pos.value = m === DIAL_OPEN ? DIAL_OPEN_POS : m;
      frac.value = withSpring(Math.min(m, DIAL_MAX) / DIAL_MAX, RSPRING.snappy);
      runOnJS(finish)(m);
    });

  const endsAt = new Date(Date.now() + live * 60000).toLocaleTimeString(c0.locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ position: 'absolute', width: size, height: size, zIndex: 13, alignItems: 'center', justifyContent: 'center' }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={a11yLabel}
        accessibilityValue={live === DIAL_OPEN ? { text: c0.open } : { min: DIAL_MIN, max: DIAL_MAX, now: live }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => {
          const up = e.nativeEvent.actionName === 'increment';
          if (up && minutes >= DIAL_MAX) { onCommit(DIAL_OPEN); return; }
          onCommit(Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.min(minutes, DIAL_MAX) + (up ? COARSE_STEP : -COARSE_STEP))));
        }}
      >
        <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const t = (i / 12) * Math.PI * 2;
            const r1 = r - 14;
            const r2 = r - (i % 3 === 0 ? 22 : 18);
            return <Line key={i} x1={c + r1 * Math.sin(t)} y1={c - r1 * Math.cos(t)} x2={c + r2 * Math.sin(t)} y2={c - r2 * Math.cos(t)} stroke={track} strokeWidth={i % 3 === 0 ? 2 : 1} />;
          })}
        </Svg>
        <Canvas pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
          <Ring size={size} r={r} frac={frac} grab={grab} color={color} />
        </Canvas>
        {dragging && LABELS.map(m => {
          const t = ((m % DIAL_MAX) / DIAL_MAX) * Math.PI * 2;
          const lr = r - 38;
          return (
            <Text key={m} pointerEvents="none" style={{ position: 'absolute', left: c + lr * Math.sin(t) - 16, top: c - lr * Math.cos(t) - 8, width: 32, textAlign: 'center', color: live === m ? '#FFFFFF' : 'rgba(255,255,255,0.45)', fontSize: F.caption, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{m}</Text>
          );
        })}
        {dragging && (
          <View pointerEvents="none" style={{ alignItems: 'center' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#FFFFFF', fontSize: Math.round(size * (live === DIAL_OPEN ? 0.16 : 0.24)), fontWeight: '700', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{live === DIAL_OPEN ? c0.open : live}</Text>
            {live !== DIAL_OPEN && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: F.footnote, fontWeight: '600', letterSpacing: 1.5 }}>{c0.unit}</Text>}
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: F.footnote, fontWeight: '600', marginTop: S.xs, fontVariant: ['tabular-nums'] }}>{live === DIAL_OPEN ? c0.openHint : live === DIAL_MAX ? c0.moreHint : c0.ends(endsAt)}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

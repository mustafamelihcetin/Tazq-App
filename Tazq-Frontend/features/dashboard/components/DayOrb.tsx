import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import { Easing, interpolateColor, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { useEntranceReady, useFirstInSession } from '@/shared/components/EntranceStage';

/*
  GÜN ÇİÇEĞİ (2026-10-30) — "yaşayan cümle"nin yanındaki duygu imzası. Kullanıcı nefes
  küresini sevdi; bu onun güne uyarlanmışı: HER İŞ BİR YAPRAK (görev ve alışkanlık birer,
  odak hedefi her 30 dk için bir; en çok 12). Yapılanlar renklenir, gün bitince çiçek tam
  açar ve yeşile döner. Bilgiyi cümle taşır; çiçek "ne kadar yol aldım"ı hissettirir.
  Sürekli hareket yok: açılışta yapraklar sırayla belirir (panel "uyanır"), yeni bir yaprak
  dolduğu an tek seferlik kıvılcım (CompletionBurst). Hareket azaltılmışsa doğrudan çizilir.

  CANLI (2026-10-31, kullanıcı: "sayfa güncellenince ya da yeni veri gelince sabit kalmamalı,
  ben canlıyım demeli"). Her hareket bir DEĞİŞİMİ söyler ve durur:
   · DOLAN yaprak renge geçerken bir kez şişip yerine oturur; GERİ ALINAN söner.
   · İş eklenip çıkınca yapraklar yeni yerlerine KAYAR (sıçramaz); yeni yaprak yerinde büyür.
   · UYANIŞ (`wake`: ekrana dönüş, uygulamanın öne gelmesi, aşağı çekip yenileme): yaprakların
     üstünden saat yönünde TEK bir ışık dalgası geçer — "veriyi yeniden okudum". Boş yapraklar
     dalga geçerken hedef rengine doğru parlar, dolular hafifçe kabarır; sonra her şey durur.
  Hareket azaltılmışsa yer değiştirme ve dalga yok; yalnız renk geçişleri kalır.
*/

export interface OrbUnits { done: number; total: number }

export const FOCUS_PETAL_MIN = 30;
const MAX_PETALS = 12;
const EASE = Easing.out(Easing.cubic);

/** Ölçülerden yaprak sayısı: görev + alışkanlık birer, odak 30 dk başına bir; 12 ile sınırlı (oran korunur). */
export function petalsOf(m: { tasks: OrbUnits; focus: OrbUnits; habits: OrbUnits }): OrbUnits {
  const total = m.tasks.total + m.habits.total + Math.ceil(m.focus.total / FOCUS_PETAL_MIN);
  const done = Math.min(m.tasks.done, m.tasks.total) + Math.min(m.habits.done, m.habits.total) + Math.min(Math.floor(m.focus.done / FOCUS_PETAL_MIN), Math.ceil(m.focus.total / FOCUS_PETAL_MIN));
  if (total <= MAX_PETALS) return { done, total };
  return { done: Math.round((done / total) * MAX_PETALS), total: MAX_PETALS };
}

/** i. yaprağın açısı (tepeden, saat yönünde) ve yarıçapı — n yapraklı halkada. */
export function petalAngle(i: number, n: number): number {
  return (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
}
export function petalRadius(n: number, size: number): number {
  return Math.min(size * 0.15, ((2 * Math.PI * size * 0.29) / Math.max(n, 1)) * 0.42);
}

/**
 * Uyanış dalgasının i. yaprakta bıraktığı ışık (0…1). `t` 0→1 ilerlerken tepe saat yönünde
 * yaprak yaprak dolaşır; dalga yokken (t ≤ 0 ya da t ≥ 1) sıfır — dinlenirken hiçbir şey parlamaz.
 */
export function sweepLift(t: number, i: number, n: number): number {
  'worklet';
  if (t <= 0 || t >= 1) return 0;
  const d = t * (n + 2) - 1 - i;
  return Math.exp(-(d * d) / 0.9);
}

type PetalProps = {
  i: number; n: number; c: number; ring: number; r: number; on: boolean; fresh: boolean; reduce: boolean;
  fill: string; track: string; appear: SharedValue<number>; sweep: SharedValue<number>;
};

const Petal = ({ i, n, c, ring, r, on, fresh, reduce, fill, track, appear, sweep }: PetalProps) => {
  const ang = useSharedValue(petalAngle(i, n));
  const rad = useSharedValue(r);
  const lit = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1); // 1 = dinlenme; 0→1 bir kez şişip oturma
  const born = useSharedValue(fresh && !reduce ? 0 : 1); // sonradan eklenen yaprak yerinde büyür
  const first = useRef(true);

  useEffect(() => { if (born.value < 1) born.value = withTiming(1, { duration: 450, easing: EASE }); }, [born]);
  // Yaprak sayısı değişince yeni yerine KAYAR.
  useEffect(() => {
    const a = petalAngle(i, n);
    ang.value = reduce ? a : withTiming(a, { duration: 500, easing: EASE });
    rad.value = reduce ? r : withTiming(r, { duration: 500, easing: EASE });
  }, [i, n, r, reduce, ang, rad]);
  // Dolma / geri alma: renk geçişi; dolarken bir kez şişip oturur (ilk çizimde değil).
  useEffect(() => {
    lit.value = withTiming(on ? 1 : 0, { duration: reduce ? 150 : 350 });
    if (!first.current && on && !reduce) { pop.value = 0; pop.value = withTiming(1, { duration: 520, easing: EASE }); }
    first.current = false;
  }, [on, reduce, lit, pop]);

  const cx = useDerivedValue(() => c + Math.cos(ang.value) * ring);
  const cy = useDerivedValue(() => c + Math.sin(ang.value) * ring);
  const rr = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, appear.value * (n + 2) - i));
    const grow = k < 1 ? k * (1.15 - 0.15 * k) : 1; // açılışta hafif taşıp yerine oturur
    const swell = 1 + 0.28 * Math.sin(Math.PI * pop.value);
    const wave = 1 + 0.16 * sweepLift(sweep.value, i, n);
    return rad.value * grow * born.value * swell * wave;
  });
  // Dalga geçerken boş yaprak hedef rengine doğru parlar; dolu yaprak zaten o renkte.
  const color = useDerivedValue(() => interpolateColor(Math.min(1, lit.value + 0.55 * sweepLift(sweep.value, i, n)), [0, 1], [track, fill]));
  return <Circle cx={cx} cy={cy} r={rr} color={color} />;
};

export function DayOrb({ units, size = 72, wake = 0 }: { units: OrbUnits; size?: number; wake?: number }) {
  const { theme } = useAppTheme();
  const low = useLowPowerGraphics();
  const reduce = useReduceMotion();
  // Yaprak açılışı yalnız oturumdaki İLK gösterimde; sekmeden dönüşte çiçek hazır çizilir.
  const first = useFirstInSession('home.dayOrb');
  const appear = useSharedValue(reduce || !first ? 1 : 0);
  const sweep = useSharedValue(0);
  /*
    Yapraklar açılış katmanı KALKINCA açılır: sayfa katmanın altında çoktan mount ediliyor ve
    900 ms'lik açılış eskiden katmanın arkasında oynayıp bitiyordu — kullanıcı hiç görmüyordu.
  */
  const ready = useEntranceReady();
  useEffect(() => {
    if (reduce || !first) { appear.value = 1; return; }
    if (!ready) return;
    appear.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [reduce, ready, appear, first]);
  // Uyanış: ilk çizimde değil (orada açılış animasyonu var), yalnız sonraki sinyallerde.
  const firstWake = useRef(wake);
  useEffect(() => {
    if (wake === firstWake.current || reduce) return;
    sweep.value = 0;
    sweep.value = withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) });
  }, [wake, reduce, sweep]);

  const complete = units.total > 0 && units.done >= units.total;
  const fill = complete ? theme.success : theme.primary;
  const track = theme.onSurface + '14';

  // Yeni bir yaprak dolduğunda kıvılcım (ilk çizimde değil).
  const prev = useRef(units.done);
  const [burst, setBurst] = useState(0);
  useEffect(() => { if (units.done > prev.current) setBurst(b => b + 1); prev.current = units.done; }, [units.done]);

  // İlk çizimden SONRA mount edilen yaprak "taze": yerinde büyüyerek gelir (5→3→5'te de).
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const n = Math.max(units.total, 1);
  const c = size / 2;
  const ring = size * 0.29;
  const r = useMemo(() => petalRadius(n, size), [n, size]);
  const centerR = useDerivedValue(() => size * 0.1 * (1 + 0.3 * sweepLift(sweep.value, n, n)));

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Canvas style={{ width: size, height: size }}>
        {complete && !low && (
          <Circle cx={c} cy={c} r={size * 0.42} color={fill} opacity={0.14}>
            <BlurMask blur={size * 0.08} style="normal" />
          </Circle>
        )}
        {units.total > 0 && Array.from({ length: n }, (_, i) => (
          <Petal key={i} i={i} n={n} c={c} ring={ring} r={r} on={i < units.done} fresh={mounted.current}
            reduce={reduce} fill={fill} track={track} appear={appear} sweep={sweep} />
        ))}
        <Circle cx={c} cy={c} r={centerR} color={units.done > 0 ? fill : track} />
      </Canvas>
      <CompletionBurst trigger={burst} color={fill} radius={size * 0.3} spread={10} particles={8} duration={700} />
    </View>
  );
}

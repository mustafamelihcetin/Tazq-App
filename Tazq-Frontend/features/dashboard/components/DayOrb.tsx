import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { CompletionBurst } from '@/shared/components/CompletionBurst';

/*
  GÜN ÇİÇEĞİ (2026-10-30) — "yaşayan cümle"nin yanındaki duygu imzası. Kullanıcı nefes
  küresini sevdi; bu onun güne uyarlanmışı: HER İŞ BİR YAPRAK (görev ve alışkanlık birer,
  odak hedefi her 30 dk için bir; en çok 12). Yapılanlar renklenir, gün bitince çiçek tam
  açar ve yeşile döner. Bilgiyi cümle taşır; çiçek "ne kadar yol aldım"ı hissettirir.
  Sürekli hareket yok: açılışta yapraklar sırayla belirir (panel "uyanır"), yeni bir yaprak
  dolduğu an tek seferlik kıvılcım (CompletionBurst). Hareket azaltılmışsa doğrudan çizilir.
*/

export interface OrbUnits { done: number; total: number }

export const FOCUS_PETAL_MIN = 30;
const MAX_PETALS = 12;

/** Ölçülerden yaprak sayısı: görev + alışkanlık birer, odak 30 dk başına bir; 12 ile sınırlı (oran korunur). */
export function petalsOf(m: { tasks: OrbUnits; focus: OrbUnits; habits: OrbUnits }): OrbUnits {
  const total = m.tasks.total + m.habits.total + Math.ceil(m.focus.total / FOCUS_PETAL_MIN);
  const done = Math.min(m.tasks.done, m.tasks.total) + Math.min(m.habits.done, m.habits.total) + Math.min(Math.floor(m.focus.done / FOCUS_PETAL_MIN), Math.ceil(m.focus.total / FOCUS_PETAL_MIN));
  if (total <= MAX_PETALS) return { done, total };
  return { done: Math.round((done / total) * MAX_PETALS), total: MAX_PETALS };
}

/** Yaprak açılışta sırayla (saat yönünde) belirir — panel "uyanır". */
const Petal = ({ i, n, x, y, r, color, appear }: { i: number; n: number; x: number; y: number; r: number; color: string; appear: SharedValue<number> }) => {
  const rr = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, appear.value * (n + 2) - i));
    return r * (k < 1 ? k * (1.15 - 0.15 * k) : 1); // hafif taşıp yerine oturur
  });
  return <Circle cx={x} cy={y} r={rr} color={color} />;
};

export function DayOrb({ units, size = 72 }: { units: OrbUnits; size?: number }) {
  const { theme } = useAppTheme();
  const low = useLowPowerGraphics();
  const reduce = useReduceMotion();
  const appear = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { appear.value = 1; return; }
    appear.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [reduce]);
  const complete = units.total > 0 && units.done >= units.total;
  const fill = complete ? theme.success : theme.primary;
  const track = theme.onSurface + '14';

  // Yeni bir yaprak dolduğunda kıvılcım (ilk çizimde değil).
  const prev = useRef(units.done);
  const [burst, setBurst] = useState(0);
  useEffect(() => { if (units.done > prev.current) setBurst(b => b + 1); prev.current = units.done; }, [units.done]);

  const petals = useMemo(() => {
    const n = Math.max(units.total, 1);
    const c = size / 2;
    const ring = size * 0.29;
    const pr = Math.min(size * 0.15, ((2 * Math.PI * ring) / n) * 0.42);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: c + Math.cos(a) * ring, y: c + Math.sin(a) * ring, r: pr };
    });
  }, [units.total, size]);

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Canvas style={{ width: size, height: size }}>
        {complete && !low && (
          <Circle cx={size / 2} cy={size / 2} r={size * 0.42} color={fill} opacity={0.14}>
            <BlurMask blur={size * 0.08} style="normal" />
          </Circle>
        )}
        {units.total > 0 && petals.map((p, i) => (
          <Petal key={i} i={i} n={petals.length} x={p.x} y={p.y} r={p.r} color={i < units.done ? fill : track} appear={appear} />
        ))}
        <Circle cx={size / 2} cy={size / 2} r={size * 0.1} color={units.done > 0 ? fill : track} />
      </Canvas>
      <CompletionBurst trigger={burst} color={fill} radius={size * 0.3} spread={10} particles={8} duration={700} />
    </View>
  );
}

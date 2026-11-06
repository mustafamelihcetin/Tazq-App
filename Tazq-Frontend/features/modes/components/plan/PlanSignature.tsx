import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { moonIllumination, passedMilestones, vineProgress } from '@/features/modes/utils/planSignature';

/*
  PLANIN İMZASI (2026-11-06, kullanıcı: "her plan kendine özgü olsun, spesifik animasyon zenginliği"). Her hedef kendi ölçüsünü kendi biçimiyle anlatır:
    · bırakma: sarmaşık temiz günle uzar, geçilen her eşikte yaprak açar
    · Ramazan: ayın hâli ayın gününü gösterir
    · öteki hedefler: PlanScenes
  Animasyon Dili: hareket bilgi taşır ve DURUR, sonsuz döngü yok. Hareketi Azalt'ta son hâl doğrudan çizilir. Reanimated + Skia: JS'te kare hesabı yok,
  düşük güçlü cihazda da tek seferlik.
*/
const EASE = Easing.out(Easing.cubic);

const useWidth = () => {
  const [w, setW] = useState(0);
  return [w, (e: { nativeEvent: { layout: { width: number } } }) => setW(e.nativeEvent.layout.width)] as const;
};

// ── Bırakma ──────────────────────────────────────────
const VINE_H = 60;
const VINE_PAD = 10;
const VINE_AMP = 7;
const VINE_WAVES = 1.5;
const vineY = (t: number) => VINE_H / 2 + VINE_AMP * Math.sin(t * Math.PI * 2 * VINE_WAVES);
const LEAF = Skia.Path.Make().moveTo(0, 0).quadTo(4, -6, 11, -3).quadTo(6, 3, 0, 0);

function Leaf({ x, y, flip, pos, end, color }: { x: number; y: number; flip: boolean; pos: number; end: SharedValue<number>; color: string }) {
  const transform = useDerivedValue(() => {
    const t = Math.min(1, Math.max(0, (end.value - pos) / 0.05));
    const s = t * (2 - t);
    return [{ translateX: x }, { translateY: y }, { rotate: flip ? 0.7 : -0.7 }, { scaleY: flip ? -s : s }, { scaleX: s }];
  });
  return <Group transform={transform}><Path path={LEAF} color={color} /></Group>;
}

export function QuitVine({ days, milestones, color, track }: { days: number; milestones: readonly number[]; color: string; track: string }) {
  const reduce = useReduceMotion();
  const [w, onLayout] = useWidth();
  // İlk eşikte de filiz görünsün: boy sıfır kalsa yaprak açılmazdı.
  const to = Math.max(0.05, vineProgress(days, milestones));
  const passed = passedMilestones(days, milestones);
  const end = useSharedValue(reduce ? to : 0);
  useEffect(() => { end.value = reduce ? to : withDelay(200, withTiming(to, { duration: 1400, easing: EASE })); }, [to, reduce, end]);
  const L = w - VINE_PAD * 2;
  const stem = useMemo(() => {
    const p = Skia.Path.Make();
    if (w <= 0) return p;
    p.moveTo(VINE_PAD, vineY(0));
    for (let i = 1; i <= 48; i++) p.lineTo(VINE_PAD + (L * i) / 48, vineY(i / 48));
    return p;
  }, [w, L]);
  const n = milestones.length;
  return (
    <View onLayout={onLayout} style={{ height: VINE_H }}>
      {w > 0 && (
        <Canvas style={{ width: w, height: VINE_H }}>
          <Path path={stem} style="stroke" strokeWidth={2} strokeCap="round" color={track} />
          <Path path={stem} style="stroke" strokeWidth={3} strokeCap="round" color={color} start={0} end={end} />
          {milestones.map((_, i) => {
            const t = n > 1 ? i / (n - 1) : 0;
            const x = VINE_PAD + L * t;
            const y = vineY(t);
            if (i < passed) return <Leaf key={i} x={x} y={y} flip={i % 2 === 1} pos={t} end={end} color={color} />;
            // Sıradaki eşik halka, uzaktakiler sessiz nokta.
            return i === passed
              ? <Circle key={i} cx={x} cy={y} r={5} style="stroke" strokeWidth={2} color={color} />
              : <Circle key={i} cx={x} cy={y} r={3} color={track} />;
          })}
        </Canvas>
      )}
    </View>
  );
}

// ── Ramazan ──────────────────────────────────────────
const MOON = 52;

export function MoonPhase({ day, duration, color, surface, track }: { day: number; duration: number; color: string; surface: string; track: string }) {
  const reduce = useReduceMotion();
  const r = MOON / 2;
  const lit = moonIllumination(day, duration);
  // Gölge diski kayarak açılır: aydınlık pay kadar kenara çekilir.
  const shift = useSharedValue(reduce ? r * 2 * lit : 0);
  useEffect(() => { shift.value = reduce ? r * 2 * lit : withDelay(200, withTiming(r * 2 * lit, { duration: 1300, easing: EASE })); }, [lit, r, reduce, shift]);
  const cx = useDerivedValue(() => r + shift.value);
  const disc = useMemo(() => Skia.Path.Make().addCircle(r, r, r), [r]);
  return (
    <Canvas style={{ width: MOON, height: MOON }}>
      <Group clip={disc}>
        <Circle cx={r} cy={r} r={r} color={color} />
        <Circle cx={cx} cy={r} r={r} color={surface} />
      </Group>
      <Circle cx={r} cy={r} r={r - 0.5} style="stroke" strokeWidth={1} color={track} />
    </Canvas>
  );
}

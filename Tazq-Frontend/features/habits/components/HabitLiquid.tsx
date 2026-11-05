import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { RSPRING } from '@/shared/constants/tokens';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/*
  DOLAN HALKA (2026-11-05, kullanıcı: "alışkanlıklar sıkıcı, daha eğlenceli ve kaliteli olmalı"). Su bardağının dili: dokununca kap dolar, sıvı çalkalanır, durur.
  Miktarlı alışkanlıkta her dokunuş bir seviye yükseltir, tekilde bir dokunuşta dolar. Animasyon yalnız durum değişince oynar; boşta hiçbir şey dönmez. Hareket azaltılmışsa seviye doğrudan yerine gelir.
*/
const STEP = 4;
const SLOSH = 2.4;

/** Yollar Canvas'ın İÇİNDE kurulur: gerçek Skia ortamında çalışırlar (bkz. Alışkanlık v2 notu). */
function Liquid({ size, stroke, level, slosh, phase, color, track }: { size: number; stroke: number; level: SharedValue<number>; slosh: SharedValue<number>; phase: SharedValue<number>; color: string; track: string }) {
  const inner = size / 2 - stroke;
  const clip = useMemo(() => Skia.PathBuilder.Make().addOval({ x: stroke, y: stroke, width: inner * 2, height: inner * 2 }).build(), [stroke, inner]);
  const water = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const y = size * (1 - level.value);
    p.moveTo(0, y + Math.sin(phase.value) * slosh.value);
    for (let x = STEP; x <= size + STEP; x += STEP) p.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 + phase.value) * slosh.value);
    p.lineTo(size + STEP, size);
    p.lineTo(0, size);
    p.close();
    return p.build();
  });
  return (
    <>
      <Group clip={clip}>
        <Path path={water} color={color} />
      </Group>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - stroke / 2} style="stroke" strokeWidth={stroke} color={track} />
    </>
  );
}

export function HabitLiquid({ size, stroke = 3, ratio, color, track, children }: { size: number; stroke?: number; ratio: number; color: string; track: string; children?: React.ReactNode }) {
  const reduce = useReduceMotion();
  const level = useSharedValue(reduce ? ratio : 0);
  const slosh = useSharedValue(0);
  const phase = useSharedValue(0);
  const pop = useSharedValue(1);
  const prev = useRef(ratio);

  useEffect(() => {
    const rose = ratio > prev.current;
    prev.current = ratio;
    if (reduce) { level.value = ratio; return; }
    level.value = withSpring(ratio, RSPRING.default);
    if (!rose) return;
    slosh.value = withSequence(withTiming(SLOSH, { duration: 120 }), withTiming(0, { duration: 820, easing: Easing.out(Easing.quad) }));
    phase.value = 0;
    phase.value = withTiming(Math.PI * 4, { duration: 940 });
    pop.value = withSequence(withTiming(ratio >= 1 ? 1.12 : 1.05, { duration: 120 }), withSpring(1, RSPRING.snappy));
  }, [ratio, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, popStyle]}>
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        <Liquid size={size} stroke={stroke} level={level} slosh={slosh} phase={phase} color={color} track={track} />
      </Canvas>
      {children}
    </Animated.View>
  );
}

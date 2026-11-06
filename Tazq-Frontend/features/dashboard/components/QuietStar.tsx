import React, { useMemo } from 'react';
import { Canvas, Path, Skia, BlurMask, Group } from '@shopify/react-native-skia';
import { MotiView } from 'moti';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

const SIZE = 72;
const C = SIZE / 2;
const ARM = 15;
const WAIST = 2.2;

/** Dört kollu yıldız; kollar içbükey, köşesiz: gökyüzü dilimizdeki ışık (bkz. WeekSky). */
function starPath() {
  const p = Skia.Path.Make();
  p.moveTo(C, C - ARM);
  p.quadTo(C + WAIST, C - WAIST, C + ARM, C);
  p.quadTo(C + WAIST, C + WAIST, C, C + ARM);
  p.quadTo(C - WAIST, C + WAIST, C - ARM, C);
  p.quadTo(C - WAIST, C - WAIST, C, C - ARM);
  p.close();
  return p;
}

/*
  BOŞ KUTU (2026-11-06). Yapılacak bir şey kalmadığında gökyüzünde tek yıldız yavaşça belirir ve durur; dönmez, parlayıp sönmez.
  Pomodoist'in boş ekran fikri, bizim gökyüzü dilimizle.
*/
export function QuietStar({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const path = useMemo(starPath, []);
  return (
    <MotiView
      testID="inbox-empty-star"
      from={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: reduce ? 0 : 900 }}
    >
      <Canvas style={{ width: SIZE, height: SIZE }}>
        <Group opacity={0.55}>
          <Path path={path} color={color}><BlurMask blur={9} style="normal" /></Path>
        </Group>
        <Path path={path} color={color} />
      </Canvas>
    </MotiView>
  );
}

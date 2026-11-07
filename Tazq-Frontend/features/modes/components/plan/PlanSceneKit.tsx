import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { RSPRING } from '@/shared/constants/tokens';

/** Sahnelerin ortak iki parçası. Ayrı dosya: PlanScenes ile PlanExamScenes birbirini içe aktarıp döngü kuruyordu. */
const EASE = Easing.out(Easing.cubic);

export function useTo(to: number, opts: { duration?: number; delay?: number; spring?: boolean } = {}) {
  const reduce = useReduceMotion();
  const v = useSharedValue(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { v.value = to; return; }
    const anim = opts.spring ? withSpring(to, RSPRING.sway) : withTiming(to, { duration: opts.duration ?? 900, easing: EASE });
    v.value = withDelay(opts.delay ?? 120, anim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduce]);
  return v;
}

export function Sized({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && <Canvas style={{ width: w, height }}>{children(w)}</Canvas>}
    </View>
  );
}

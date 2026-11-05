import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, MIN_TOUCH, RSPRING } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { haptic } from '@/shared/utils/haptics';
import { toDateKey } from '@/shared/utils/dateKey';
import type { WaterGoal } from '@/features/modes/utils/waterGoal';
import { PLAN_COPY } from './planCopy';

/*
  KÜÇÜK BARDAK (2026-11-05). Dokunursan bir yudum: bardak hafifçe eğilir, su yükselir, çalkalanır, durur. Animasyon yalnız dokununca oynar ve bilgi taşır (kaç bardak kaldı); boşta hiçbir şey dönmez.
  Sayaç güne bağlı ve görevden bağımsız: su sudur, iki hedefte aynı görev olsa da aynı bardaklar sayılır. Yanlış dokunuş uzun basışla geri alınır.
*/
export const useWaterStore = create<{ day: string | null; glasses: number; add: (d: number) => void; reset: () => void }>()(
  persist(
    (set, get) => ({
      day: null,
      glasses: 0,
      add: (d) => {
        const today = toDateKey(new Date());
        const base = get().day === today ? get().glasses : 0;
        set({ day: today, glasses: Math.max(0, base + d) });
      },
      reset: () => set({ day: null, glasses: 0 }),
    }),
    { name: 'tazq-water', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

const W_GLASS = 30;
const H_GLASS = 38;
const INSET = 3; // bardağın dibi ağzından dar
const STEP = 3;

const glassPath = () => {
  const p = Skia.PathBuilder.Make();
  p.moveTo(1, 1);
  p.lineTo(W_GLASS - 1, 1);
  p.lineTo(W_GLASS - 1 - INSET, H_GLASS - 1);
  p.lineTo(1 + INSET, H_GLASS - 1);
  p.close();
  return p.build();
};

export function WaterGlass({ goal, lang, onFull }: { goal: WaterGoal; lang: 'tr' | 'en'; onFull?: () => void }) {
  const { theme } = useAppTheme();
  const c = PLAN_COPY[lang].water;
  const reduce = useReduceMotion();
  const today = toDateKey(new Date());
  const stored = useWaterStore(s => (s.day === today ? s.glasses : 0));
  const count = Math.min(stored, goal.glasses);
  const full = count >= goal.glasses;
  const glass = useMemo(glassPath, []);

  const level = useSharedValue(count / goal.glasses);
  const slosh = useSharedValue(0);
  const phase = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    const target = count / goal.glasses;
    if (reduce) { level.value = target; return; }
    level.value = withSpring(target, RSPRING.default);
  }, [count, goal.glasses, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const water = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const y = H_GLASS * (1 - level.value);
    p.moveTo(0, y + Math.sin(phase.value) * slosh.value);
    for (let x = STEP; x <= W_GLASS; x += STEP) p.lineTo(x, y + Math.sin((x / W_GLASS) * Math.PI * 2 + phase.value) * slosh.value);
    p.lineTo(W_GLASS, H_GLASS);
    p.lineTo(0, H_GLASS);
    p.close();
    return p.build();
  });
  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  const sip = () => {
    haptic.surface();
    if (!reduce) {
      tilt.value = withSequence(withTiming(-14, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, RSPRING.snappy));
      slosh.value = withSequence(withTiming(2.6, { duration: 120 }), withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) }));
      phase.value = 0;
      phase.value = withTiming(Math.PI * 4, { duration: 1020 });
    }
    if (!full) useWaterStore.getState().add(1);
    if (count + 1 >= goal.glasses && goal.pure) onFull?.();
  };
  const unsip = () => { if (count > 0) { haptic.select(); useWaterStore.getState().add(-1); } };

  const line = full ? (goal.pure ? c.full : c.fullRest) : c.count(count, goal.glasses);
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={`${c.drink}. ${line}`} accessibilityHint={c.undoHint} onPress={sip} onLongPress={unsip} style={st.row}>
      <Animated.View style={[{ width: W_GLASS, height: H_GLASS }, tiltStyle]}>
        <Canvas style={{ width: W_GLASS, height: H_GLASS }}>
          <Group clip={glass}>
            <Path path={water} color={theme.info} opacity={0.75} />
          </Group>
          <Path path={glass} style="stroke" strokeWidth={1.5} color={theme.onSurfaceMuted} strokeJoin="round" />
        </Canvas>
      </Animated.View>
      <View style={{ flex: 1, gap: S.xxs }}>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{full ? line : c.drink}</Text>
        {!full && <Text style={{ fontSize: F.caption, fontVariant: ['tabular-nums'], color: theme.onSurfaceMuted }}>{line}</Text>}
      </View>
    </Touchable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: MIN_TOUCH, paddingVertical: S.xs },
});

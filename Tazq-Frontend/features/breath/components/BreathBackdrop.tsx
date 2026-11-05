import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, { FadeIn, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Canvas, RadialGradient, Rect, mix, vec } from '@shopify/react-native-skia';
import { BreathPalette } from '@/shared/constants/Colors';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { AMBIENT_FPS, Nebula } from '@/features/focus/components/FocusBackdrop';
import type { FocusSceneId } from '@/features/focus/utils/focusScenes';
import type { BreathId } from '@/features/breath/patterns';

/*
  YAŞAYAN ZEMİN (2026-11-05, kullanıcı: "daha filmli olmalı"). Her amacın kendi dünyası var: Sakinleş su altı, Odaklan tek çekirdek, Uyu gece perdeleri, Denge orman sisi. Renk amaçtan gelir.
  Seansta zemin nefesle birlikte parlar: alınca toplanır, verince söner. Amaç değişince eskisi yenisinin altında kalır, yenisi yavaşça açılır; ani geçiş yok.
*/
const WORLD: Record<BreathId, FocusSceneId> = { sigh: 'tide', box: 'ember', sleep: 'aurora', resonance: 'mist' };
const FADE_MS = 900;
const SPEED = 0.45;
const OPACITY = 0.7;

function World({ id, hold, still }: { id: BreathId; hold?: SharedValue<number>; still?: boolean }) {
  const { width, height } = useWindowDimensions();
  const low = useLowPowerGraphics();
  const reduce = useReduceMotion();
  const pal = BreathPalette[id];
  return (
    <Nebula size={0} width={width} height={height} c1={pal.petals[0]} c2={pal.petals[1]} c3={pal.accent} scene={WORLD[id]} base={[pal.bg[0], pal.bg[1]]} speedScale={SPEED} paused={reduce || !!still} lowFps={low} fps={AMBIENT_FPS} holdSV={hold} />
  );
}

export function BreathBackdrop({ id, hold }: { id: BreathId; hold?: SharedValue<number> }) {
  const [prev, setPrev] = useState<BreathId | null>(null);
  const [cur, setCur] = useState(id);
  useEffect(() => {
    if (id === cur) return;
    setPrev(cur);
    setCur(id);
    const t = setTimeout(() => setPrev(null), FADE_MS + 100);
    return () => clearTimeout(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: OPACITY }]}>
      {prev && <View style={StyleSheet.absoluteFill}><World id={prev} still /></View>}
      <Reanimated.View key={cur} entering={FadeIn.duration(FADE_MS)} style={StyleSheet.absoluteFill}><World id={cur} hold={hold} /></Reanimated.View>
    </View>
  );
}

/*
  NEFESLE AÇILAN IŞIK (2026-11-06; siyah bantların yerine). Sert kenar yok: ekranın kenarı yumuşakça kararır,
  nefes alırken ışık genişler, verirken daralır. Bilgi taşır: ekranın tamamı nefes alır, göz ortada kalır.
*/
export function BreathEdge({ level }: { level: SharedValue<number> }) {
  const { width, height } = useWindowDimensions();
  const low = useLowPowerGraphics();
  const reduce = useReduceMotion();
  const far = Math.hypot(width, height) / 2;
  const r = useDerivedValue(() => mix(level.value, far * 0.82, far * 1.25));
  if (low || reduce) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(width / 2, height / 2)} r={r} colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} positions={[0.45, 1]} />
      </Rect>
    </Canvas>
  );
}

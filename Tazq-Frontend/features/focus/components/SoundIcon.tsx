import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/*
  ÇALAN SESİN SİMGESİ KENDİ KARAKTERİYLE HAREKET EDER (2026-11-01, kullanıcı: "kafe sesiyse kahve ikonunun
  dumanları hareket eder, okyanussa dalgalar olur"). Ortak çubuk göstergesinin yerine geçer.
    kafe: buhar yükselip söner · yağmur: damlalar düşer · okyanus: dalgalar sırayla kayar ·
    rüzgar: çizgiler esintiyle akar · orman: ağaçlar sallanır · şömine: alev titrer ·
    rahatlatıcı: nota süzülür · frekans: kulaklık nabız atar · derin gürültü: çizgiler inip kalkar.
  Çizimler lucide'nin AYNI yolları (durağan simgeyle birebir); hareket eden her parça ayrı katman
  (Animated.View) — SVG içi hareketli özellik yerine iki platformda da güvenilir yol.
  Hareketi Azalt açıksa durağan simge.
*/
export type SoundKind = 'rain' | 'wind' | 'cafe' | 'forest' | 'ocean' | 'fireplace' | 'relaxing' | 'binaural' | 'brown';

const SW = 2;

function useLoop(duration: number, still: boolean): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) { t.value = 0; return; }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [duration, still, t]);
  return t;
}

/** Tam kutuyu kaplayan bir SVG katmanı (24'lük görünüm kutusu). */
function Layer({ size, color, children, style }: { size: number; color: string; children: React.ReactNode; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Aşamalı parça: t + faz döngüsünde dikey/yatay kayma ve opaklık. */
function usePhase(t: SharedValue<number>, phase: number, f: (p: number) => { x?: number; y?: number; o?: number; r?: number; s?: number; sy?: number }, unit: number) {
  return useAnimatedStyle(() => {
    const p = (t.value + phase) % 1;
    const v = f(p);
    return {
      opacity: v.o ?? 1,
      transform: [
        { translateX: (v.x ?? 0) * unit }, { translateY: (v.y ?? 0) * unit },
        { rotate: `${v.r ?? 0}deg` }, { scale: v.s ?? 1 }, { scaleY: v.sy ?? 1 },
      ],
    };
  });
}

const rise = (p: number) => { 'worklet'; return { y: 1.5 - p * 3.5, o: p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8 }; };
const fall = (p: number) => { 'worklet'; return { y: p * 3.5, o: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85 }; };
const roll = (p: number) => { 'worklet'; return { x: Math.sin(p * Math.PI * 2) * 1.6 }; };
const gust = (p: number) => { 'worklet'; return { x: Math.sin(p * Math.PI * 2) * 2, o: 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p * Math.PI * 2)) }; };
const sway = (p: number) => { 'worklet'; return { r: Math.sin(p * Math.PI * 2) * 6 }; };
const flicker = (p: number) => { 'worklet'; return { sy: 1 + 0.07 * Math.sin(p * Math.PI * 2) + 0.04 * Math.sin(p * Math.PI * 6), s: 1 + 0.03 * Math.sin(p * Math.PI * 4) }; };
const bob = (p: number) => { 'worklet'; return { y: Math.sin(p * Math.PI * 2) * 1.6, r: Math.sin(p * Math.PI * 2) * 8 }; };
const pulse = (p: number) => { 'worklet'; return { s: 1 + 0.09 * Math.sin(p * Math.PI * 2) }; };
const bar = (p: number) => { 'worklet'; return { sy: 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(p * Math.PI * 2)) }; };

export function SoundIcon({ kind, size, color }: { kind: SoundKind; size: number; color: string }) {
  const still = useReduceMotion();
  const u = size / 24;
  const period = { cafe: 1800, rain: 950, ocean: 2400, wind: 2000, forest: 2800, fireplace: 700, relaxing: 1600, binaural: 1100, brown: 900 }[kind];
  const t = useLoop(period, still);
  // Kancalar her türde aynı sırayla çağrılır (React kuralı); kullanılmayanlar zararsız.
  const a = usePhase(t, 0, kind === 'cafe' ? rise : kind === 'rain' ? fall : kind === 'ocean' ? roll : kind === 'wind' ? gust : kind === 'brown' ? bar : sway, u);
  const b = usePhase(t, 1 / 3, kind === 'cafe' ? rise : kind === 'rain' ? fall : kind === 'ocean' ? roll : kind === 'wind' ? gust : bar, u);
  const c = usePhase(t, 2 / 3, kind === 'cafe' ? rise : kind === 'rain' ? fall : kind === 'ocean' ? roll : kind === 'wind' ? gust : bar, u);
  const whole = usePhase(t, 0, kind === 'forest' ? sway : kind === 'fireplace' ? flicker : kind === 'relaxing' ? bob : kind === 'binaural' ? pulse : () => { 'worklet'; return {}; }, u);
  const box = { width: size, height: size };

  switch (kind) {
    case 'cafe':
      return (
        <View style={box}>
          <Layer size={size} color={color}><Path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /></Layer>
          <Layer size={size} color={color} style={a}><Path d="M6 2v2" /></Layer>
          <Layer size={size} color={color} style={b}><Path d="M10 2v2" /></Layer>
          <Layer size={size} color={color} style={c}><Path d="M14 2v2" /></Layer>
        </View>
      );
    case 'rain':
      return (
        <View style={box}>
          <Layer size={size} color={color}><Path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /></Layer>
          <Layer size={size} color={color} style={a}><Path d="M8 14v4" /></Layer>
          <Layer size={size} color={color} style={b}><Path d="M12 16v4" /></Layer>
          <Layer size={size} color={color} style={c}><Path d="M16 14v4" /></Layer>
        </View>
      );
    case 'ocean':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={a}><Path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></Layer>
          <Layer size={size} color={color} style={b}><Path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></Layer>
          <Layer size={size} color={color} style={c}><Path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></Layer>
        </View>
      );
    case 'wind':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={a}><Path d="M9.8 4.4A2 2 0 1 1 11 8H2" /></Layer>
          <Layer size={size} color={color} style={b}><Path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /></Layer>
          <Layer size={size} color={color} style={c}><Path d="M12.8 19.6A2 2 0 1 0 14 16H2" /></Layer>
        </View>
      );
    case 'brown':
      return (
        <View style={box}>
          <Layer size={size} color={color}><Path d="M2 10v3" /><Path d="M22 10v3" /></Layer>
          <Layer size={size} color={color} style={a}><Path d="M6 6v11" /><Path d="M18 5v13" /></Layer>
          <Layer size={size} color={color} style={b}><Path d="M10 3v18" /></Layer>
          <Layer size={size} color={color} style={c}><Path d="M14 8v7" /></Layer>
        </View>
      );
    case 'forest':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={[whole, { transformOrigin: 'bottom' }]}>
            <Path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><Path d="M7 16v6" /><Path d="M13 19v3" />
            <Path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />
          </Layer>
        </View>
      );
    case 'fireplace':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={[whole, { transformOrigin: 'bottom' }]}>
            <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </Layer>
        </View>
      );
    case 'relaxing':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={whole}><Circle cx={8} cy={18} r={4} /><Path d="M12 18V2l7 4" /></Layer>
        </View>
      );
    case 'binaural':
      return (
        <View style={box}>
          <Layer size={size} color={color} style={whole}>
            <Path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
          </Layer>
        </View>
      );
  }
}

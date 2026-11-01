import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import type { QuoteKind } from '@/shared/constants/Quotes';

/*
  CÜMLENİN SAHNESİ (2026-11-01, kullanıcı: "betimle derken görselleştir demek istemiştim").
  Odak ekranının alt cümlesinin SOLUNDA küçük (56 pt; yazıyla tek blok), ince çizgili, YAVAŞ bir sahne: cümlenin anlattığı şey görünür.
    nefes: halka genişleyip daralır (4 sn al · 4 sn ver) · bulut: süzülüp geçer · yağmur: damla damla ·
    kapı: yavaşça kapanır · zemin: yere değen noktadan halkalar · adım: nokta basamak basamak çıkar ·
    dalga: ses dalgası akar · dağ: nokta zirveye tırmanır · güneş: ufuktan yükselir · sayfa: satırlar yazılır · çan: hafifçe sallanır ·
    durgun: sakin suya tek damla düşer.
  Hareket eden her parça ayrı katman (SoundIcon ile aynı yol: iki platformda güvenilir). Hareketi Azalt → durağan.
*/

const W = 56;
const H = 36;

function useLoop(duration: number, still: boolean): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    if (still) return;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [duration, still, t]);
  return t;
}

/** Sahnenin tamamını kaplayan bir SVG katmanı. */
function Layer({ color, children, style }: { color: string; children: React.ReactNode; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, style]}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </Svg>
    </Animated.View>
  );
}

type Pose = { x?: number; y?: number; o?: number; s?: number; r?: number; sx?: number };
function usePose(t: SharedValue<number>, phase: number, f: (p: number) => Pose) {
  return useAnimatedStyle(() => {
    const v = f((t.value + phase) % 1);
    return {
      opacity: v.o ?? 1,
      transform: [{ translateX: v.x ?? 0 }, { translateY: v.y ?? 0 }, { scale: v.s ?? 1 }, { rotate: `${v.r ?? 0}deg` }, { scaleX: v.sx ?? 1 }],
    };
  });
}

const PERIOD: Record<QuoteKind, number> = {
  breath: 8000, cloud: 12000, rain: 1800, door: 9000, ground: 4200, step: 5200, wave: 4000, sun: 10000, page: 6000, bell: 3200, still: 5200, mountain: 6000,
};

// Yumuşak giriş/çıkış: 0→1→0
const hump = (p: number) => { 'worklet'; return 0.5 - 0.5 * Math.cos(p * Math.PI * 2); };

const POSES: Record<QuoteKind, [(p: number) => Pose, (p: number) => Pose, (p: number) => Pose]> = {
  breath: [
    (p) => { 'worklet'; return { s: 0.7 + 0.45 * hump(p) }; },
    (p) => { 'worklet'; return { s: 0.85 + 0.5 * hump(p), o: 0.15 + 0.35 * hump(p) }; },
    () => { 'worklet'; return {}; },
  ],
  cloud: [
    (p) => { 'worklet'; return { x: -14 + p * 28, o: p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1 }; },
    (p) => { 'worklet'; const q = (p + 0.5) % 1; return { x: -14 + q * 28, o: 0.4 * (q < 0.15 ? q / 0.15 : q > 0.85 ? (1 - q) / 0.15 : 1) }; },
    () => { 'worklet'; return {}; },
  ],
  rain: [
    (p) => { 'worklet'; return { y: p * 16, o: p < 0.1 ? p / 0.1 : 1 - p }; },
    (p) => { 'worklet'; const q = (p + 0.33) % 1; return { y: q * 16, o: q < 0.1 ? q / 0.1 : 1 - q }; },
    (p) => { 'worklet'; const q = (p + 0.66) % 1; return { y: q * 16, o: q < 0.1 ? q / 0.1 : 1 - q }; },
  ],
  door: [
    // kapanır (0–0.4), kapalı kalır, yavaşça yeniden aralanır (0.8–1)
    (p) => { 'worklet'; const c = p < 0.4 ? p / 0.4 : p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2; return { sx: 1 - 0.82 * (0.5 - 0.5 * Math.cos(c * Math.PI)) }; },
    (p) => { 'worklet'; const c = p < 0.4 ? p / 0.4 : p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2; return { o: 0.9 * (1 - c) }; },
    () => { 'worklet'; return {}; },
  ],
  ground: [
    (p) => { 'worklet'; return { s: 0.3 + p * 1.4, o: 0.6 * (1 - p) }; },
    (p) => { 'worklet'; const q = (p + 0.5) % 1; return { s: 0.3 + q * 1.4, o: 0.6 * (1 - q) }; },
    () => { 'worklet'; return {}; },
  ],
  step: [
    // Basamak basamak ZIPLAR (kullanıcı: "merdiveni düz geçiyor, merdivene göre yükselse"): her dilimde önce
    // küçük bir yayla bir üst basamağa konar (dilimin %40'ı), sonra basamakta durur; tepede bekleyip söner.
    (p) => {
      'worklet';
      const slot = Math.min(3, Math.floor(p * 4));
      const f = p * 4 - slot;
      if (slot === 3) return { x: 36, y: -18, o: f > 0.6 ? (1 - f) / 0.4 : 1 };
      const e = f < 0.4 ? f / 0.4 : 1;
      const s = 0.5 - 0.5 * Math.cos(e * Math.PI);
      return { x: (slot + s) * 12, y: -(slot + s) * 6 - Math.sin(e * Math.PI) * 5, o: p < 0.03 ? p / 0.03 : 1 };
    },
    () => { 'worklet'; return {}; },
    () => { 'worklet'; return {}; },
  ],
  wave: [
    (p) => { 'worklet'; return { x: -p * 24 }; },
    (p) => { 'worklet'; return { x: -((p + 0.5) % 1) * 24, o: 0.4 }; },
    () => { 'worklet'; return {}; },
  ],
  sun: [
    (p) => { 'worklet'; return { y: 10 - 10 * hump(p) }; },
    (p) => { 'worklet'; return { o: hump(p) * 0.8, s: 0.9 + 0.1 * hump(p) }; },
    () => { 'worklet'; return {}; },
  ],
  page: [
    (p) => { 'worklet'; return { sx: Math.min(1, p / 0.25) }; },
    (p) => { 'worklet'; return { sx: Math.max(0, Math.min(1, (p - 0.25) / 0.25)) }; },
    (p) => { 'worklet'; return { sx: Math.max(0, Math.min(1, (p - 0.5) / 0.2)), o: p > 0.9 ? (1 - p) / 0.1 : 1 }; },
  ],
  bell: [
    (p) => { 'worklet'; return { r: Math.sin(p * Math.PI * 2) * 9 }; },
    (p) => { 'worklet'; return { o: 0.6 * Math.max(0, Math.sin(p * Math.PI * 2)), s: 1 + 0.2 * Math.max(0, Math.sin(p * Math.PI * 2)) }; },
    (p) => { 'worklet'; return { o: 0.6 * Math.max(0, -Math.sin(p * Math.PI * 2)), s: 1 + 0.2 * Math.max(0, -Math.sin(p * Math.PI * 2)) }; },
  ],
  // dağ: hedef — nokta yamaçtan zirveye tırmanır, zirvede bekler, söner
  mountain: [
    (p) => { 'worklet'; const e = Math.min(1, p / 0.7); const k = 0.5 - 0.5 * Math.cos(e * Math.PI); return { x: k * 14, y: -k * 14, o: p > 0.9 ? (1 - p) / 0.1 : 1 }; },
    () => { 'worklet'; return {}; },
    () => { 'worklet'; return {}; },
  ],
  still: [
    (p) => { 'worklet'; return { y: p < 0.3 ? -12 + (p / 0.3) * 12 : 0, o: p < 0.3 ? 1 : 0 }; },
    (p) => { 'worklet'; const q = p < 0.3 ? 0 : (p - 0.3) / 0.7; return { s: 0.2 + q * 1.3, o: p < 0.3 ? 0 : 0.7 * (1 - q) }; },
    () => { 'worklet'; return {}; },
  ],
};

export function QuoteScene({ kind, color }: { kind: QuoteKind; color: string }) {
  const still = useReduceMotion();
  const t = useLoop(PERIOD[kind], still);
  const [fa, fb, fc] = POSES[kind];
  const a = usePose(t, 0, fa);
  const b = usePose(t, 0, fb);
  const c = usePose(t, 0, fc);
  const cx = W / 2;
  const cy = H / 2;
  const horizon = <Line x1={4} y1={H - 6} x2={W - 4} y2={H - 6} opacity={0.35} />;

  let body: React.ReactNode = null;
  switch (kind) {
    case 'breath':
      body = <>
        <Layer color={color} style={b}><Circle cx={cx} cy={cy} r={13} /></Layer>
        <Layer color={color} style={a}><Circle cx={cx} cy={cy} r={9} /></Layer>
      </>;
      break;
    case 'cloud': {
      const cloud = <Path d={`M${cx - 14} ${cy + 6} h28 a6 6 0 0 0 0 -12 a8 8 0 0 0 -15 -3 a6 6 0 0 0 -13 9 a3 3 0 0 0 0 6 z`} />;
      body = <>
        <Layer color={color} style={b}>{cloud}</Layer>
        <Layer color={color} style={a}>{cloud}</Layer>
      </>;
      break;
    }
    case 'rain':
      body = <>
        <Layer color={color}>{horizon}</Layer>
        <Layer color={color} style={a}><Line x1={cx - 14} y1={8} x2={cx - 14} y2={12} /></Layer>
        <Layer color={color} style={b}><Line x1={cx} y1={6} x2={cx} y2={10} /></Layer>
        <Layer color={color} style={c}><Line x1={cx + 14} y1={9} x2={cx + 14} y2={13} /></Layer>
      </>;
      break;
    case 'door':
      body = <>
        <Layer color={color}><Rect x={cx - 11} y={5} width={22} height={H - 11} rx={1.5} opacity={0.5} />{horizon}</Layer>
        <Layer color={color} style={b}><Path d={`M${cx + 14} ${cy} h8 M${cx + 16} ${cy - 5} h6 M${cx + 16} ${cy + 5} h6`} /></Layer>
        <Layer color={color} style={[a, { transformOrigin: `${cx - 11}px ${cy}px` }]}><Rect x={cx - 11} y={5} width={22} height={H - 11} rx={1.5} /><Circle cx={cx + 7} cy={cy + 2} r={0.8} /></Layer>
      </>;
      break;
    case 'ground':
      body = <>
        <Layer color={color}>{horizon}<Circle cx={cx} cy={H - 9} r={2} fill={color} /></Layer>
        <Layer color={color} style={[a, { transformOrigin: `${cx}px ${H - 9}px` }]}><Path d={`M${cx - 14} ${H - 9} a14 5 0 0 0 28 0`} /></Layer>
        <Layer color={color} style={[b, { transformOrigin: `${cx}px ${H - 9}px` }]}><Path d={`M${cx - 14} ${H - 9} a14 5 0 0 0 28 0`} /></Layer>
      </>;
      break;
    case 'step':
      body = <>
        <Layer color={color}><Path d={`M${cx - 24} ${H - 6} h12 v-6 h12 v-6 h12 v-6 h12`} opacity={0.5} /></Layer>
        <Layer color={color} style={a}><Circle cx={cx - 18} cy={H - 10} r={2.4} fill={color} /></Layer>
      </>;
      break;
    case 'wave': {
      let d = `M0 ${cy}`;
      for (let x = 0; x < W + 24; x += 12) d += ` q3 -7 6 0 t6 0`;
      body = <>
        <Layer color={color} style={b}><Path d={d} transform={`translate(0 4)`} /></Layer>
        <Layer color={color} style={a}><Path d={d} /></Layer>
      </>;
      break;
    }
    case 'sun':
      body = <>
        <Layer color={color} style={[b, { transformOrigin: `${cx}px ${H - 6}px` }]}><Path d={`M${cx} 6 v-3 M${cx - 15} 12 l-2 -2 M${cx + 15} 12 l2 -2 M${cx - 18} ${H - 14} h-3 M${cx + 18} ${H - 14} h3`} /></Layer>
        <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H - 6, overflow: 'hidden' }}>
          <Layer color={color} style={a}><Circle cx={cx} cy={H - 6} r={11} /></Layer>
        </View>
        <Layer color={color}>{horizon}</Layer>
      </>;
      break;
    case 'page':
      body = <>
        <Layer color={color}><Rect x={cx - 13} y={3} width={26} height={H - 6} rx={2} opacity={0.6} /></Layer>
        <Layer color={color} style={[a, { transformOrigin: `${cx - 8}px 0px` }]}><Line x1={cx - 8} y1={11} x2={cx + 8} y2={11} /></Layer>
        <Layer color={color} style={[b, { transformOrigin: `${cx - 8}px 0px` }]}><Line x1={cx - 8} y1={17} x2={cx + 8} y2={17} /></Layer>
        <Layer color={color} style={[c, { transformOrigin: `${cx - 8}px 0px` }]}><Line x1={cx - 8} y1={23} x2={cx + 3} y2={23} /></Layer>
      </>;
      break;
    case 'bell':
      body = <>
        <Layer color={color} style={b}><Path d={`M${cx - 15} ${cy - 6} a8 8 0 0 0 0 12`} /></Layer>
        <Layer color={color} style={c}><Path d={`M${cx + 15} ${cy - 6} a8 8 0 0 1 0 12`} /></Layer>
        <Layer color={color} style={[a, { transformOrigin: `${cx}px 4px` }]}><Path d={`M${cx - 9} ${cy + 7} c0 -4 2 -6 2 -10 a7 7 0 0 1 14 0 c0 4 2 6 2 10 z M${cx - 2} ${cy + 10} a2 2 0 0 0 4 0 M${cx} 4 v3`} /></Layer>
      </>;
      break;
    case 'mountain':
      body = <>
        <Layer color={color}><Path d={`M${cx - 22} ${H - 6} L${cx} ${H - 26} L${cx + 22} ${H - 6}`} opacity={0.6} />{horizon}</Layer>
        <Layer color={color} style={a}><Circle cx={cx - 14} cy={H - 10} r={2.2} fill={color} /></Layer>
      </>;
      break;
    case 'still':
      body = <>
        <Layer color={color}>{horizon}</Layer>
        <Layer color={color} style={a}><Circle cx={cx} cy={H - 7} r={1.6} fill={color} /></Layer>
        <Layer color={color} style={[b, { transformOrigin: `${cx}px ${H - 6}px` }]}><Path d={`M${cx - 14} ${H - 6} a14 4 0 0 0 28 0`} /></Layer>
      </>;
      break;
  }

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: W, height: H, opacity: 0.75 }}>
      {body}
    </View>
  );
}

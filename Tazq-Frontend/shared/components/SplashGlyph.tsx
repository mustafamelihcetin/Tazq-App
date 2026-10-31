import React, { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

/*
  AÇILIŞ İŞARETLERİ — kendini çizen ince çizgi simgeler (SVG, 2026-10-31).
  Önce Skia'daydı; Android'de (Huawei) açılışta aynı anda kurulan küçük Skia tuvalleri yüzey
  hatası verip BOŞ kaldı (logcat: "Unable to update texture contents"). SVG + Reanimated iki
  platformda da güvenilir. Her işaret polyline listesi; her çizgi kendi zaman penceresinde,
  kesik-çizgi kaydırmasıyla (strokeDashoffset) çizilir.
*/

export type GlyphKind = 'list' | 'ring' | 'check' | 'wave' | 'arrow' | 'spark';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Pt = [number, number];
/** Birim karede (0..1) çizgiler + çizim pencereleri [başla, bitir] (ilerleme 0..1 içinde). */
function shapes(kind: GlyphKind): { lines: Pt[][]; windows: [number, number][]; track?: boolean } {
  switch (kind) {
    case 'list':
      return {
        lines: [[[0.12, 0.28], [0.88, 0.28]], [[0.12, 0.5], [0.72, 0.5]], [[0.12, 0.72], [0.56, 0.72]]],
        windows: [[0, 0.6], [0.2, 0.8], [0.4, 1]],
      };
    case 'ring': {
      // Dörtte üç: tam halka boş bir daire gibi okunuyordu; 3/4 = işleyen zamanlayıcı.
      const pts: Pt[] = [];
      for (let i = 0; i <= 36; i++) {
        const a = -Math.PI / 2 + (i / 36) * Math.PI * 1.5;
        pts.push([0.5 + 0.38 * Math.cos(a), 0.5 + 0.38 * Math.sin(a)]);
      }
      return { lines: [pts], windows: [[0, 1]], track: true };
    }
    case 'check':
      return { lines: [[[0.18, 0.54], [0.42, 0.76], [0.84, 0.28]]], windows: [[0, 1]] };
    case 'wave': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 28; i++) {
        const x = 0.1 + (i / 28) * 0.8;
        pts.push([x, 0.5 + 0.18 * Math.sin((i / 28) * Math.PI * 3)]);
      }
      return { lines: [pts], windows: [[0, 1]] };
    }
    case 'arrow':
      return {
        lines: [[[0.14, 0.5], [0.82, 0.5]], [[0.58, 0.26], [0.84, 0.5], [0.58, 0.74]]],
        windows: [[0, 0.7], [0.55, 1]],
      };
    case 'spark':
      return {
        lines: [[[0.5, 0.42], [0.5, 0.1]], [[0.58, 0.5], [0.9, 0.5]], [[0.5, 0.58], [0.5, 0.9]], [[0.42, 0.5], [0.1, 0.5]]],
        windows: [[0, 0.6], [0.13, 0.73], [0.26, 0.86], [0.4, 1]],
      };
  }
}

const lengthOf = (pts: Pt[], s: number) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot((p[0] - pts[i][0]) * s, (p[1] - pts[i][1]) * s), 0);

function Stroke({ d, len, win, progress, color, width }: {
  d: string; len: number; win: [number, number]; progress: SharedValue<number>; color: string; width: number;
}) {
  const [a, b] = win;
  const props = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, (progress.value - a) / (b - a)));
    return { strokeDashoffset: len * (1 - t) };
  });
  return (
    <AnimatedPath d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none"
      strokeDasharray={[len, len]} animatedProps={props} />
  );
}

export function SplashGlyph({ kind, size, color, track, progress }: {
  kind: GlyphKind; size: number; color: string; track: string; progress: SharedValue<number>;
}) {
  const width = Math.max(2.5, size * 0.1);
  const { lines, windows, track: hasTrack } = useMemo(() => shapes(kind), [kind]);
  const paths = useMemo(() => lines.map(pts => ({
    d: pts.map((p, i) => `${i ? 'L' : 'M'}${(p[0] * size).toFixed(2)} ${(p[1] * size).toFixed(2)}`).join(' '),
    len: lengthOf(pts, size) + 0.5,
  })), [lines, size]);
  return (
    <Svg width={size} height={size}>
      {hasTrack && <Circle cx={size / 2} cy={size / 2} r={size * 0.38} stroke={track} strokeWidth={width} fill="none" />}
      {paths.map((p, i) => (
        <Stroke key={i} d={p.d} len={p.len} win={windows[i]} progress={progress} color={color} width={width} />
      ))}
    </Svg>
  );
}

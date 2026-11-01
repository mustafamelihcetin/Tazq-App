import React, { useEffect, useMemo } from 'react';
import { Canvas, Circle, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { RSPRING } from '@/shared/constants/tokens';

/*
  DÖRT HAFTALIK EĞİLİM ÇİZGİSİ — Modların Özeti kahramanı (2026-10-31).

  Kaynak: react-native-skia örnekleri (Graphs → yol + start/end) ve uygulamanın kendi
  "çizilen" dili (WeekPanel halkaları, WeekSky). Çizgi soldan sağa ÇİZİLEREK gelir, altındaki
  dolgu ardından belirir, bu haftanın noktası en son yerine oturur: göz geçmişten bugüne
  okur. Bir kez oynar ve durur (animasyon bilgi taşır ve durur); "hareketi azalt"ta son hâl.
*/
const PAD = 5;

export function TrendLine({ values, width, height, color, play }: { values: number[]; width: number; height: number; color: string; play: boolean }) {
  const { line, area, last } = useMemo(() => {
    const max = Math.max(1, ...values);
    const step = (width - PAD * 2) / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => ({ x: PAD + i * step, y: height - PAD - (v / max) * (height - PAD * 2) }));
    const l = Skia.Path.Make();
    l.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2;
      l.cubicTo(mx, a.y, mx, b.y, b.x, b.y);
    }
    const f = l.copy();
    f.lineTo(pts[pts.length - 1].x, height);
    f.lineTo(pts[0].x, height);
    f.close();
    return { line: l, area: f, last: pts[pts.length - 1] };
  }, [values, width, height]);

  const draw = useSharedValue(play ? 0 : 1);
  const fill = useSharedValue(play ? 0 : 1);
  const dot = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    draw.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    fill.value = withDelay(380, withTiming(1, { duration: 420 }));
    dot.value = withDelay(700, withSpring(1, RSPRING.pop));
  }, [play, draw, fill, dot]);
  const r = useDerivedValue(() => 3.5 * dot.value);
  const halo = useDerivedValue(() => 7 * dot.value);

  return (
    <Canvas style={{ width, height }}>
      <Path path={area} opacity={fill}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[color + '40', color + '00']} />
      </Path>
      <Path path={line} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" color={color} start={0} end={draw} />
      <Circle cx={last.x} cy={last.y} r={halo} color={color + '33'} />
      <Circle cx={last.x} cy={last.y} r={r} color={color} />
    </Canvas>
  );
}

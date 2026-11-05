import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { BlurMask, Canvas, Circle, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/*
  YOLUN ÇİZİLİŞİ (2026-11-05, kullanıcı: "animasyonel bir şeyler eksik, filmsellik sıfır"). Planı açınca yol başlangıçtan bugüne kadar çizilir, önde parlayan bir ışık gider,
  bugünde durur ve orada kalır. Sonsuz döngü yok, pil yemez (bkz. Animasyon Dili: animasyon bilgi taşır ve durur). Çizginin geldiği yer gerçek ilerlemedir.
  Işık, kaynayan iz eğriye ayrı hesaplanır: x t ile doğrusal, eğri sığ olduğundan Skia'nın uzunluk kırpmasıyla gözle ayrılmaz.
*/
const H = 52;
const PAD = 18;
// Parlama tuvale sığsın: Skia tuval sınırında keser (kare görünüyordu). Tuval kartın dolgusuna taşar, çizgi tarih etiketleriyle hizalı kalır.
const BLEED = 12;
const DURATION = 1300;
const DELAY = 220;

export function PlanRoadLine({ progress, color, track, surface }: { progress: number; color: string; track: string; surface: string }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const to = Math.max(0.02, Math.min(1, progress));
  const end = useSharedValue(reduce ? to : 0);
  const y0 = H - PAD;
  const y3 = PAD;
  const L = w - PAD * 2;

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    if (w <= 0) return p;
    p.moveTo(PAD, y0);
    p.cubicTo(PAD + L / 3, y0, PAD + (2 * L) / 3, y3, PAD + L, y3);
    return p;
  }, [w, L, y0, y3]);

  useEffect(() => {
    if (w <= 0) return;
    end.value = reduce ? to : withDelay(DELAY, withTiming(to, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
  }, [w, to, reduce, end]);

  const cx = useDerivedValue(() => PAD + L * end.value);
  const cy = useDerivedValue(() => {
    const t = end.value;
    const u = 1 - t;
    return u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y3 + t * t * t * y3;
  });

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: H, marginHorizontal: -BLEED }}>
      {w > 0 && (
        <Canvas style={{ width: w, height: H }}>
          <Path path={path} style="stroke" strokeWidth={3} strokeCap="round" color={track} />
          <Path path={path} style="stroke" strokeWidth={6} strokeCap="round" color={color} opacity={0.35} start={0} end={end}>
            <BlurMask blur={5} style="normal" />
          </Path>
          <Path path={path} style="stroke" strokeWidth={3} strokeCap="round" start={0} end={end}>
            <LinearGradient start={vec(PAD, 0)} end={vec(PAD + L * to, 0)} colors={[`${color}55`, color]} />
          </Path>
          <Circle cx={PAD + L} cy={y3} r={4} style="stroke" strokeWidth={2} color={track} />
          <Circle cx={cx} cy={cy} r={9} color={color} opacity={0.3}>
            <BlurMask blur={4} style="normal" />
          </Circle>
          <Circle cx={cx} cy={cy} r={6} color={color} />
          <Circle cx={cx} cy={cy} r={2.5} color={surface} />
        </Canvas>
      )}
    </View>
  );
}

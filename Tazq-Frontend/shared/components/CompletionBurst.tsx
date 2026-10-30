import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, BlurMask } from '@shopify/react-native-skia';
import { Easing, runOnJS, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';

/*
  TAMAMLAMA KIVILCIMI (2026-10-30, kullanıcı: "nefesteki animasyonlu gösterim çok hoşuma
  gitti, başka yerlerde de"). Bir hedef tamamlanınca TEK SEFERLİK: yumuşak bir ışık halkası
  dışa açılıp söner, küçük kıvılcımlar halkadan uzaklaşır. Sürekli animasyon değil —
  liste satırlarında sürekli hareket pil yer ve dikkat dağıtır.

  `trigger` değiştiğinde oynar (ilk çizimde OYNAMAZ: ekran açılırken her dolu baloncuk
  patlamasın). Hareket azaltılmışsa hiç çizilmez; düşük güçte bulanıklık yok.
  Tuval, sahibinin etrafına `spread` kadar taşar ve dokunmayı engellemez. Tuval YALNIZ
  oynarken vardır: ana sayfada her baloncuk/halka için boşta bekleyen Skia yüzeyi bellek yer.
*/

interface Props {
  /** Değişince bir kez oynar. */
  trigger: number;
  color: string;
  /** Halkanın başladığı yarıçap (sahibinin yarıçapı). */
  radius: number;
  /** Işığın sahibinden dışa taşabileceği pay. */
  spread?: number;
  particles?: number;
  duration?: number;
}

const Spark = ({ i, n, c, radius, spread, p, color }: { i: number; n: number; c: { x: number; y: number }; radius: number; spread: number; p: SharedValue<number>; color: string }) => {
  const theta = (i / n) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const cx = useDerivedValue(() => c.x + Math.cos(theta) * (radius + spread * 0.9 * p.value));
  const cy = useDerivedValue(() => c.y + Math.sin(theta) * (radius + spread * 0.9 * p.value));
  const r = useDerivedValue(() => 2.4 * (1 - p.value) + 0.6);
  const o = useDerivedValue(() => (p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85));
  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={o} />;
};

export function CompletionBurst({ trigger, color, radius, spread = 14, particles = 8, duration = 700 }: Props) {
  const reduce = useReduceMotion();
  const low = useLowPowerGraphics();
  const p = useSharedValue(1);
  const first = useRef(true);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    setActive(true);
    p.value = 0;
    p.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) }, (done) => { if (done) runOnJS(setActive)(false); });
  }, [trigger]);

  const size = (radius + spread) * 2;
  const c = { x: size / 2, y: size / 2 };
  const ringR = useDerivedValue(() => radius + spread * 0.7 * p.value);
  const ringO = useDerivedValue(() => (p.value >= 1 ? 0 : 0.55 * (1 - p.value)));
  const ringW = useDerivedValue(() => 3 * (1 - p.value) + 1);
  const sparkO = useDerivedValue(() => (p.value >= 1 ? 0 : 1));

  if (reduce || !active) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2 }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle c={c} r={ringR} color={color} style="stroke" strokeWidth={ringW} opacity={ringO}>
          {!low && <BlurMask blur={3} style="solid" />}
        </Circle>
        <Group opacity={sparkO}>
          {Array.from({ length: particles }, (_, i) => (
            <Spark key={i} i={i} n={particles} c={c} radius={radius} spread={spread} p={p} color={color} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

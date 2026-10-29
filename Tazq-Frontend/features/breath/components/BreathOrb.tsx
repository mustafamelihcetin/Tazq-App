import React, { useMemo } from 'react';
import { Canvas, Circle, Group, BlurMask, vec, mix, useClock } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { BreathPalette } from '@/shared/constants/Colors';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { patternOf, phaseAt, cycleSec, type BreathId } from '@/features/breath/patterns';

/*
  NEFES KÜRESİ (madde 14) — Skia. Teknik: react-native-skia örneklerindeki "Breathe"
  (yapraklar merkezden kutupsal açılır, ekran karışımıyla üst üste biner, yumuşak bulanık).
  Bizde yapraklar SAATE değil nefesin kendisine bağlı: `level` 0 → boş akciğer (yapraklar
  merkezde, küçük), 1 → dolu (açılmış, tam boy). Yaprak sayısı ritmi anlatır: kutu
  nefesinde 4 (kare), 4-7-8'de 8. Dolu bekleyişte hafif bir parıltı "tut" der.

  Düşük güçlü cihazda bulanıklık yarıya iner (Huawei Y6: tam bulanıklık kare düşürüyordu).
*/

interface OrbProps {
  id: BreathId;
  size: number;
  /** 0..1 akciğer doluluğu */
  level: SharedValue<number>;
}

const Petal = ({ i, n, c, r, level, color }: { i: number; n: number; c: { x: number; y: number }; r: number; level: SharedValue<number>; color: string }) => {
  const transform = useDerivedValue(() => {
    const theta = (i * 2 * Math.PI) / n;
    const d = level.value * r;
    return [{ translateX: Math.cos(theta) * d }, { translateY: Math.sin(theta) * d }, { scale: mix(level.value, 0.32, 1) }];
  });
  return <Circle c={c} r={r} color={color} origin={c} transform={transform} />;
};

export function BreathOrb({ id, size, level }: OrbProps) {
  const p = patternOf(id);
  const pal = BreathPalette[id];
  const low = useLowPowerGraphics();
  const center = useMemo(() => vec(size / 2, size / 2), [size]);
  const r = size * 0.2;
  const clock = useClock();
  // Açılırken çeyrek tur kıvrılır + çok yavaş sürekli dönüş (durağan görünmesin).
  const groupT = useDerivedValue(() => [{ rotate: mix(level.value, -Math.PI / 4, 0) + (clock.value / 1000) * 0.04 }]);
  const coreR = useDerivedValue(() => r * mix(level.value, 0.55, 1.15));
  const ringOpacity = useDerivedValue(() => 0.1 + level.value * 0.12);
  // Dolu bekleyiş (tut): çekirdek yavaşça parıldar — durağan küre "dondu" gibi okunmasın.
  const coreOpacity = useDerivedValue(() => 0.22 + (level.value > 0.97 ? 0.1 * (0.5 + 0.5 * Math.sin(clock.value / 380)) : 0));

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      {/* Hedef halkası: "buraya kadar dol" — dolu küre tam bu çizgiye ulaşır. */}
      <Circle c={center} r={r * 2} color={pal.accent} style="stroke" strokeWidth={1} opacity={ringOpacity} />
      <Circle c={center} r={coreR} color={pal.accent} opacity={coreOpacity}>
        <BlurMask blur={low ? 18 : 36} style="normal" />
      </Circle>
      <Group origin={center} transform={groupT} blendMode="screen" opacity={0.92}>
        <BlurMask blur={low ? 10 : 22} style="solid" />
        {Array.from({ length: p.petals }, (_, i) => (
          <Petal key={i} i={i} n={p.petals} c={center} r={r} level={level} color={pal.petals[i % 2]} />
        ))}
      </Group>
    </Canvas>
  );
}

/**
 * Seçicideki canlı önizleme: kendi saatinde ritmi sonsuz döngüde oynatır. `still` iken
 * (seçili değil / hareket azaltılmış) yarı dolu durur — dört küre aynı anda dönmesin.
 */
export function BreathPreview({ id, size, still }: { id: BreathId; size: number; still?: boolean }) {
  const p = patternOf(id);
  const reduce = useReduceMotion();
  const clock = useClock();
  const frozen = useSharedValue(0.62);
  const stop = !!still || reduce;
  const cyc = cycleSec(p);
  const level = useDerivedValue(() => (stop ? frozen.value : phaseAt(p, (clock.value / 1000) % cyc, 1).level));
  return <BreathOrb id={id} size={size} level={level} />;
}

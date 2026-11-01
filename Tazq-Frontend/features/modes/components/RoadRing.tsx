import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useFirstInSession } from '@/shared/components/EntranceStage';

/*
  YOL HALKASI — durum kartında hedef ikonunun çevresi (2026-10-31).

  Geri sayım yalnız "kaç gün kaldı" diyordu; halka yolun NE KADARININ geçtiğini gösterir
  (bkz. roadProgress). Haftalık Merkez'in gün halkalarıyla aynı dil (Skia yay, start/end):
  oturumdaki ilk görüşte çizilerek dolar, sonra durur; "hareketi azalt"ta doğrudan son hâl.
  Başlangıç bilinmiyorsa (progress null) yalnız soluk iz çizilir — uydurma ilerleme yok.
*/
const STROKE = 3;

export function RoadRing({ size, progress, color, id, children }: { size: number; progress: number | null; color: string; id: string; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const first = useFirstInSession(`road-${id}`);
  const play = first && !reduce;
  const to = progress ?? 0;
  const end = useSharedValue(play ? 0 : to);

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const r = size / 2 - STROKE / 2;
    p.addArc({ x: size / 2 - r, y: size / 2 - r, width: r * 2, height: r * 2 }, -90, 359.9);
    return p;
  }, [size]);

  useEffect(() => {
    end.value = play
      ? withDelay(180, withTiming(to, { duration: 1100, easing: Easing.out(Easing.cubic) }))
      : to;
  }, [to, play, end]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - STROKE / 2} style="stroke" strokeWidth={STROKE} color={color + '26'} />
        {progress != null && progress > 0 && (
          <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} start={0} end={end} />
        )}
      </Canvas>
      {children}
    </View>
  );
}

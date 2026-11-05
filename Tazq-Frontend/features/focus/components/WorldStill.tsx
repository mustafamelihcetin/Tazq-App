import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { AMBIENT_FPS, Nebula } from '@/features/focus/components/FocusBackdrop';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { lightsFor, sceneOf, MAX_WORLD_LIGHTS } from '@/features/focus/utils/focusScenes';

const REPLAY_MS = 2600;

/*
  Seans özetinin kahramanı: bu seansın bıraktığı dünya, canlı. Açılırken seans kısaca yeniden oynar: dünya başlangıçtan bugünkü hâline gelir.
  Yarım kalan seans da gerçek hâlini gösterir, cezalandırmaz. Üstündeki yazı çocuk olarak gelir.
*/
export function WorldHero({ sceneId, minutes, plannedMinutes, height, children }: { sceneId: string | null | undefined; minutes: number; plannedMinutes: number; height: number; children: React.ReactNode }) {
  const scene = sceneOf(sceneId);
  const low = useLowPowerGraphics();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const done = plannedMinutes > 0 ? Math.min(1, minutes / plannedMinutes) : 1;
  const count = Math.min(MAX_WORLD_LIGHTS, lightsFor(minutes));
  const growth = useSharedValue(reduce ? done : 0);
  const lights = useSharedValue(reduce ? count : 0);
  const born = useSharedValue(0);
  const world = useMemo(() => ({ growth, lights, born }), []);
  useEffect(() => {
    if (reduce) return;
    growth.value = withTiming(done, { duration: REPLAY_MS });
    if (count === 0) return;
    // Parçalar sırayla belirir; animasyon yok, adımlar seyrek olduğu için çizim yükü düşük.
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      lights.value = n;
      if (n >= count) clearInterval(id);
    }, REPLAY_MS / count);
    return () => clearInterval(id);
  }, []);
  const [c1, c2, c3] = scene.lights ?? scene.stars;
  return (
    <View style={{ height, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {w > 0 && <Nebula size={0} width={w} height={height} c1={c1} c2={c2} c3={c3} scene={scene.id} base={scene.base} paused={reduce} lowFps={low} fps={AMBIENT_FPS} speedScale={0.65} world={world} />}
      </View>
      {children}
    </View>
  );
}

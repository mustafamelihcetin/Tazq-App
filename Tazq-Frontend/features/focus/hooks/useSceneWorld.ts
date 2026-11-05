import { useEffect, useMemo } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { worldFor } from '@/features/focus/utils/focusScenes';

/*
  ODAKLA BÜYÜYEN DÜNYA (2026-11-05, kullanıcı: "oyunlaştıralım, meditasyon ve odak mantığının dışına çıkmadan, her birinde kendine özgü").
  Puan ve ceza yok; ödül sahnenin kendisi: seans ilerledikçe dünya değişir, 5 dakikada bir kalıcı bir parçası eklenir.
  Ekranı yeniden çizdirmez: mağazaya abonedir, değerler doğrudan shader'a gider.
  Büyüme adım adım yazılır (animasyon yok): sürekli animasyon, kare sınırını aşıp her karede çizdirirdi. Yalnız seans başı ve doğuş kısa süre yumuşar.
*/
export interface SceneWorld {
  growth: SharedValue<number>;
  lights: SharedValue<number>;
  born: SharedValue<number>;
}

const FADE_MS = 2200;
const BORN_MS = 2800;
/** Bu kadar değişmeden yazılmaz: gereksiz çizim yok, adım gözle görülmez. */
const GROWTH_STEP = 0.002;

export function useSceneWorld(): SceneWorld {
  const growth = useSharedValue(1);
  const lights = useSharedValue(0);
  const born = useSharedValue(0);

  useEffect(() => {
    let wasActive = false;
    let lastGrowth = 1;
    let lastLights = 0;
    const apply = (s: Parameters<typeof worldFor>[0]) => {
      const w = worldFor(s);
      if (!w) return; // molada dünya olduğu gibi kalır
      if (w.active !== wasActive) {
        growth.value = withTiming(w.growth, { duration: FADE_MS });
        lastGrowth = w.growth;
      } else if (w.active && Math.abs(w.growth - lastGrowth) >= GROWTH_STEP) {
        growth.value = w.growth;
        lastGrowth = w.growth;
      }
      if (w.lights !== lastLights) {
        // Oturum kaldığı yerden açılınca parçalar sessizce yerinde olur; doğuş yalnız seans içinde.
        if (wasActive && w.lights > lastLights) {
          born.value = 1;
          born.value = withTiming(0, { duration: BORN_MS });
        }
        lights.value = w.lights;
        lastLights = w.lights;
      }
      wasActive = w.active;
    };
    apply(useFocusStore.getState());
    return useFocusStore.subscribe(apply);
  }, []);

  return useMemo(() => ({ growth, lights, born }), []);
}

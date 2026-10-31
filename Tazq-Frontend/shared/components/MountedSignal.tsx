import { useEffect } from 'react';

/** Ağaç ilk kez kurulup iki kare çizilince haber verir (açılış animasyonu iş parçacıkları boşalınca başlasın). */
export function MountedSignal({ onMounted }: { onMounted: () => void }) {
  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(onMounted); });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

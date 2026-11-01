import { useEffect, useRef, useState } from 'react';
import { noteSeen, peekSeen } from '@/shared/utils/seenValues';

/**
 * Bir sayının "ne değişti"si (B1). Değerler tek motordan gelir; bu kanca yalnız farkı söyler.
 *  · from  — yeniden kurulumda (sekmeye dönüş) en son görülen değer; DEĞİŞMEDİYSE undefined (sahte sayım yok).
 *  · delta — son değişimin farkı (ekrandayken ya da dönüşte); "+1" bunu gösterir.
 * `key` yoksa hiçbir şey hatırlanmaz. Okuma yan etkisiz (geliştirme kipinde çift çağrılabilir);
 * yazma efektte.
 */
export function useSeenChange(key: string | undefined, value: number): { from: number | undefined; delta: number } {
  const [initial] = useState(() => {
    const prev = key ? peekSeen(key) : undefined;
    return prev != null && prev !== value ? { from: prev, delta: value - prev } : { from: undefined as number | undefined, delta: 0 };
  });
  const last = useRef(value);
  const [delta, setDelta] = useState(initial.delta);

  useEffect(() => {
    if (key) noteSeen(key, value);
    if (last.current === value) return;
    setDelta(value - last.current);
    last.current = value;
  }, [key, value]);

  return { from: initial.from, delta };
}

import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/**
 * Değer değişince eskisinden yenisine sayarak gider, sonra durur. Süre ve eğri Bluesky CountWheel ile aynı: 400 ms, cubic out.
 * İlk çizimde saymaz; Hareketi Azalt açıkken doğrudan yeni değer.
 */
export function useCountingValue(value: number, ms = 400): number {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    if (reduce || shownRef.current === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - startedAt) / ms);
      const next = k >= 1 ? value : Math.round(from + (value - from) * (1 - (1 - k) ** 3));
      shownRef.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms, reduce]);

  return shown;
}

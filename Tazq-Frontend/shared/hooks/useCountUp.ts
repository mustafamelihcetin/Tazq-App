import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from './useReduceMotion';

const MOUNT_GRACE_MS = 300;

/**
 * Sayı hedefe sayarak gelir. Animasyon süstür, sayı doğru olmak zorundadır (2026-11-05, cihazda iki kez "Bugün 0 işin kaldı"):
 * 0'dan başlayan sayaç, JS meşgulken saniyelerce 0'da kalıyordu. Artık gerçek sayıyla başlar; açılış sayımı yalnız uygulama rahatsa oynar.
 * Süre dolunca zamanlayıcı son değeri yine yazar.
 */
export function useCountUp(target: number, duration = 800): number {
  const reduce = useReduceMotion();
  const [value, setValue] = useState(target);
  const born = useRef(Date.now());
  const from = useRef<number | null>(null);
  useEffect(() => {
    // İlk çalışma: gecikmişse sayma, doğru sayı zaten ekranda.
    const first = from.current == null;
    const late = first && Date.now() - born.current > MOUNT_GRACE_MS;
    const start = first ? (late ? target : 0) : (from.current as number);
    from.current = target;
    if (reduce || start === target) { setValue(target); return; }
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / duration);
      setValue(Math.round(start + (target - start) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const settle = setTimeout(() => { cancelAnimationFrame(frame); setValue(target); }, duration + 60);
    return () => { cancelAnimationFrame(frame); clearTimeout(settle); };
  }, [target, duration, reduce]);
  return value;
}

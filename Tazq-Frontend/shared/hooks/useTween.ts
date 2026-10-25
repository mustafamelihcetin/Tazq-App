import { useEffect, useRef, useState } from 'react';

/*
  ── JS ARA-DEĞER (tween) — halka dolumları için ───────────────────────────────────
  Neden Reanimated `animatedProps` değil: cihazda (Android, Fabric) Bugün halkalarının
  yayları tur sırasında BOŞ kalıyordu — ana sayfa yeniden çizildikçe canlandırılan SVG
  özelliği ilk değerine dönüyordu; son değeri statik vermek de çözmedi (bkz.
  __tests__/useTween.test.ts). Burada değer JS'te ilerler ve düz prop olarak çizilir:
  React ne çizerse ekranda o vardır. Üç küçük halka için kare başına maliyet ihmal edilir.
*/

interface Opts {
  duration: number;
  delay?: number;
  reduceMotion?: boolean;
  /** İlk çizimdeki değer — halkalar açılışta 0'dan dolar (Apple Activity). Verilmezse hedef. */
  initial?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTween(target: number, { duration, delay = 0, reduceMotion = false, initial }: Opts): number {
  const [value, setValue] = useState(initial ?? target);
  const valueRef = useRef(target);
  valueRef.current = value;

  useEffect(() => {
    if (reduceMotion || duration <= 0) { setValue(target); return; }
    const from = valueRef.current;
    if (from === target) return;
    let raf: ReturnType<typeof requestAnimationFrame> | null = null;
    let start = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      start = Date.now();
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, reduceMotion]);

  return reduceMotion ? target : value;
}

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bir öğeye çift dokunulduğunda geçici "vurgu" durumu üretir.
 *
 * app/index.tsx'ten çıkarıldı: aynı çift-dokunma + zamanlayıcıyla söndürme mantığı
 * ekran gövdesinde iki kez kopyalanmıştı ve her kopya kendi setTimeout'unu
 * temizlemiyordu — bileşen vurgu sönmeden kapanırsa unmount sonrası setState olurdu.
 *
 * Burada zamanlayıcı ref'te tutulur, yeni dokunmada ve unmount'ta iptal edilir.
 */

/** İki dokunmanın "çift dokunma" sayılması için aralarındaki azami süre. */
export const DOUBLE_TAP_WINDOW_MS = 380;

export type DoubleTapHighlight = {
  /** Vurgu şu an açık mı? */
  active: boolean;
  /** Her tetiklemede artar; animasyonu yeniden başlatmak için key olarak kullanılır. */
  burstKey: number;
  /** Dokunma işleyicisi — Touchable onPress'e bağlanır. */
  onTap: () => void;
};

export function useDoubleTapHighlight(
  durationMs: number,
  onTrigger?: () => void,
): DoubleTapHighlight {
  const [active, setActive] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bileşen vurgu sönmeden kapanırsa zamanlayıcı iptal edilmeli.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS) {
      onTrigger?.();
      setBurstKey(k => k + 1);
      setActive(true);

      // Arka arkaya tetiklemede eski zamanlayıcı vurguyu erken söndürmemeli.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setActive(false);
      }, durationMs);
    }
    // Sayaç tetikleme olsun olmasın her dokunuşta güncellenir: hızlı ard arda
    // dokunmada 2., 3., 4. dokunuşların HEPSİ tetikler. Bu, hook'a çıkarılmadan
    // önceki davranışın aynısıdır — kasıtlı korunuyor (refactor davranışı değiştirmez).
    lastTapRef.current = now;
  }, [durationMs, onTrigger]);

  return { active, burstKey, onTap };
}

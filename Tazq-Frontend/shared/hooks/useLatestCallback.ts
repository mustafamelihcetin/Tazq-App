import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * KİMLİĞİ SABİT, GÖVDESİ GÜNCEL OLAY İŞLEYİCİSİ (React'in useEffectEvent deseni).
 *
 * memo'lu bir çocuğa verilen işleyici her render'da yeni fonksiyon olunca memo hiç tutmuyor.
 * `useCallback` + bağımlılık listesi ise bir bağımlılık unutulunca BAYAT kapanış bırakıyor.
 * Bu kanca ikisini birden çözer: döndürdüğü fonksiyon hep aynı, çağrıldığı an ise en son
 * COMMIT edilen gövdeyi çalıştırır — bağımlılık listesi yok, unutulacak bir şey yok.
 *
 * YALNIZ OLAY İŞLEYİCİLERİ İÇİN (dokunma, basma). Render sırasında çağrılan bir fonksiyon
 * (ör. renk seçici) için kullanılmaz: gövde commit'ten sonra güncellenir, render anında bir
 * öncekini görür.
 */
export function useLatestCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  // Layout effect: atılan (commit edilmeyen) bir render'ın gövdesi asla kaydedilmez.
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: A) => ref.current(...args), []);
}

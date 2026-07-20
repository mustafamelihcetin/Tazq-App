import { useEffect, useRef, useState } from 'react';

/**
 * Bir değer "durulana" kadar bekletir: değişim durduktan `delay` ms sonra yayınlar.
 *
 * Neden: dashboard'daki momentum skoru tek bir kaynaktan gelmiyor — görevler, haftalık
 * odak, seri ve alışkanlık verisi farklı store'lardan ayrı ayrı hidrate oluyor. Her biri
 * yerine oturduğunda skor yeniden hesaplanıyor ve ilk açılışta kullanıcı 14 → 15 → 17 →
 * 18 → 17 gibi bir sayaç kayması görüyor. Bu ara değerler yanlış değil, sadece EKSİK
 * veriyle hesaplanmış; ekranda gösterilmeleri için bir sebep yok.
 *
 * Gecikme yalnızca değer DEĞİŞTİĞİNDE işler; sabit kalan değer anında geçer.
 */
export function useSettledValue<T>(value: T, delay = 400): T {
  const [settled, setSettled] = useState(value);
  const settledRef = useRef(value);

  useEffect(() => {
    if (Object.is(value, settledRef.current)) return;

    const timer = setTimeout(() => {
      settledRef.current = value;
      setSettled(value);
    }, delay);

    // Değer bekleme süresi dolmadan tekrar değişirse sayaç sıfırlanır; böylece
    // yalnızca son değer yayınlanır, aradakiler hiç ekrana çıkmaz.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

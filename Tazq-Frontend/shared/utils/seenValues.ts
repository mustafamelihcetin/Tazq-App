/**
 * SON GÖRÜLEN DEĞERLER — oturum belleği (2026-10-31, B1/B3).
 *
 * Her ekran sayısı (ör. "bugünün planı", momentum) bir anahtarla en son GÖRÜLDÜĞÜ değeri bırakır.
 * Sekmeler yeniden kurulduğunda sayı o değerden yenisine akar; "+1" farkı buradan okur.
 * Diske YAZILMAZ: ertesi gün açılışta dünkü değerden akış yanlış bir "değişim" anlatırdı
 * (geri sayımın diske yazan hâli bilinçli olarak ayrı — bkz. useCountdownTick).
 */
const seen = new Map<string, number>();

/** Önceki görülen değeri döndürür, yenisini kaydeder. */
export function noteSeen(key: string, value: number): number | undefined {
  const prev = seen.get(key);
  seen.set(key, value);
  return prev;
}

/** Yan etkisiz okuma. */
export function peekSeen(key: string): number | undefined {
  return seen.get(key);
}

/** Testler için. */
export function resetSeen(): void {
  seen.clear();
}

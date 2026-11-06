/*
  ÜRÜNÜN GÜN TANIMI, TEK YERDE (2026-11-06). Gün 03:00'te değişir: gece 01:30'da yapılan iş hâlâ dünün işidir (Loop'taki "yeni günü bekle",
  Kado'daki DayBoundary). Bu kural 14 ayrı yerde elle yazılıydı.

  "Bugün ne yaptım" bu dosyadan, "hangi gün olacak" toDateKey'den okunur (bkz. dateKey.ts): 3 Ağustos'a kurulan sınav 3 Ağustos'tur.
*/
export const APP_DAY_START_HOUR = 3;

/** Şu anın ürün günündeki karşılığı; yeni bir Date döner, çağıran değiştirebilir. */
export function logicalNow(now: Date = new Date()): Date {
  const adjusted = new Date(now);
  adjusted.setHours(adjusted.getHours() - APP_DAY_START_HOUR);
  return adjusted;
}

/** Ürün gününün 'YYYY-MM-DD' anahtarı. */
export function appDayKey(now: Date = new Date()): string {
  const d = logicalNow(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Gece yarısı ile 03:00 arası: takvim yeni günde, ürün hâlâ dünde. */
export const isBeforeRollover = (now: Date = new Date()): boolean => now.getHours() < APP_DAY_START_HOUR;

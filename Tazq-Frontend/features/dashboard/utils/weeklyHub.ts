import { langOf } from '@/shared/utils/lang';

/*
  HAFTALIK SAYI BİÇİMLERİ — saf, test edilmiş (bkz. __tests__/weeklyHub.test.ts).

  Kural: yalnız ÖLÇÜLEN şey söylenir; veri yoksa sayı sıfır değil "yok"tur.
  (Ana sayfadaki içgörü penceresi 2026-10-31'de kaldırıldı — kıyas ve öneriler Rapor'da.)
*/

const UNITS = { tr: { h: ' sa', m: ' dk', sep: ' ' }, en: { h: 'h', m: 'm', sep: ' ' } } as const;

/** 200 → "3 sa 20 dk" / "3h 20m". */
export function formatMinutes(total: number, lang: string): string {
  const u = UNITS[langOf(lang)];
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}${u.m}`;
  return m === 0 ? `${h}${u.h}` : `${h}${u.h}${u.sep}${m}${u.m}`;
}

/** En çok odaklanılan günün sırası; hiç odak yoksa `null` (en iyi gün "uydurulmaz"). */
export function bestDayIndex(days: { minutes?: number }[] | undefined): number | null {
  let best: number | null = null;
  let max = 0;
  (days ?? []).forEach((d, i) => {
    const v = d.minutes ?? 0;
    if (v > max) { max = v; best = i; }
  });
  return best;
}

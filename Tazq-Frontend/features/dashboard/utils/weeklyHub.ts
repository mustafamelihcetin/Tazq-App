import { langOf } from '@/shared/utils/lang';

/*
  İÇGÖRÜ MODALININ SAYILARI — saf, test edilmiş (bkz. __tests__/weeklyHub.test.ts).

  Kural: modal yalnız ÖLÇTÜĞÜ şeyi söyler. Ölçülemeyen bir karşılaştırma (geçen hafta
  kayıt yok) yüzdeyle değil cümleyle anlatılır; veri yoksa sayı sıfır değil "yok"tur.
*/

export type FocusDelta = { kind: 'none' } | { kind: 'new' } | { kind: 'change'; pct: number };

/** Bu haftanın odak dakikası geçen haftaya göre. Sıfıra göre yüzde tanımsızdır → 'new'. */
export function focusDelta(thisWeek: number, lastWeek: number): FocusDelta {
  if (lastWeek <= 0) return thisWeek > 0 ? { kind: 'new' } : { kind: 'none' };
  return { kind: 'change', pct: Math.round(((thisWeek - lastWeek) / lastWeek) * 100) };
}

/** 12 → "+%12" / "+12%": Türkçede yüzde işareti sayının önünde. */
export function formatDeltaPct(pct: number, lang: string): string {
  const sign = pct >= 0 ? '+' : '-';
  const n = Math.abs(pct);
  return langOf(lang) === 'tr' ? `${sign}%${n}` : `${sign}${n}%`;
}

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

/**
 * Geçen haftanın BUGÜNE KADARKİ günlerinin toplamı (Pzt = 0). Bu haftanın yarısını geçen
 * haftanın tamamıyla kıyaslamak, hafta başında trendi hep eksi gösteriyordu.
 */
export function sameSpanTotal(perDay: number[], todayIndex: number): number {
  return perDay.slice(0, Math.max(0, todayIndex) + 1).reduce((s, v) => s + (v || 0), 0);
}

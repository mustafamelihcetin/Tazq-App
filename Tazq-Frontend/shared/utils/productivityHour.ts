/*
  "EN VERİMLİ OLDUĞUN ZAMAN" — cevabın uygulamada NE yaptığı, tek yerde (2026-10-25).

  Kullanıcı: "userın kafasında 'ne yapacak, ne zaman verimli olduğumu' sorusu kalmamalı;
  algoritma işleyecekse işlemeli." Tercih iki saate karşılık gelir:
   · brief — günlük özet bildirimi bu saatte gelir (bkz. notifications.briefHourFor)
   · work  — saat verilmemiş hatırlatıcılar bu saate kurulur (bkz. taskFormDates.defaultReminderSlot)
  Eskiden hatırlatıcı herkese sabit 09:00'du: "gece verimliyim" diyen sabah dokuzda dürtülüyordu.
  Ekranda gösterilen açıklama da bu tablodan üretilir — vaat ile davranış ayrışamaz.
*/

export type ProductivityHour = 'morning' | 'afternoon' | 'evening' | 'night';

export const PRODUCTIVITY_HOURS: Record<ProductivityHour, { brief: number; work: number }> = {
  morning: { brief: 7, work: 9 },
  afternoon: { brief: 12, work: 13 },
  evening: { brief: 17, work: 18 },
  night: { brief: 21, work: 22 },
};

const entry = (p: string | null | undefined) =>
  PRODUCTIVITY_HOURS[(p ?? '') as ProductivityHour] ?? PRODUCTIVITY_HOURS.morning;

export const briefHourOf = (p: string | null | undefined) => entry(p).brief;
export const workHourOf = (p: string | null | undefined) => entry(p).work;

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/*
  Türkçe saat eki OKUNUŞA göre: "22:00'ye" (yirmi iki-ye), "09:00'a" (dokuz-a), "17:00'de"
  (on yedi-de). Son okunan kelime: birler basamağı, yoksa onlar (on/yirmi).
*/
const LAST_WORD: Record<number, string> = { 1: 'bir', 2: 'iki', 3: 'üç', 4: 'dört', 5: 'beş', 6: 'altı', 7: 'yedi', 8: 'sekiz', 9: 'dokuz', 10: 'on', 20: 'yirmi' };
const lastWord = (h: number) => LAST_WORD[h % 10 || h] ?? 'sıfır';
const BACK = /[aıou][^aeıioöuü]*$/;
const vowelBack = (w: string) => BACK.test(w);
const endsVowel = (w: string) => /[aeıioöuü]$/.test(w);
const hard = (w: string) => /[çfhkpsşt]$/.test(w);
/** -de/-da/-te/-ta */
const loc = (h: number) => { const w = lastWord(h); return `'${hard(w) ? 't' : 'd'}${vowelBack(w) ? 'a' : 'e'}`; };
/** -e/-a/-ye/-ya */
const dat = (h: number) => { const w = lastWord(h); return `'${endsVowel(w) ? 'y' : ''}${vowelBack(w) ? 'a' : 'e'}`; };

const HINT = {
  tr: (b: number, w: number) => `Günlük özetin ${hh(b)}${loc(b)} gelir; saat vermediğin hatırlatıcılar ${hh(w)}${dat(w)} kurulur.`,
  en: (b: number, w: number) => `Your daily brief arrives at ${hh(b)}; reminders without a time are set for ${hh(w)}.`,
};

/** Seçimin altında gösterilen tek cümle — bu tablodan, yani davranışın kendisinden. */
export function productivityHint(p: string | null | undefined, lang: 'tr' | 'en'): string {
  const { brief, work } = entry(p);
  return HINT[lang](brief, work);
}

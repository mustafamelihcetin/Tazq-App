import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';
import { langOf, localeOf } from '@/shared/utils/lang';

/*
  YENİ HEDEF FORMUNUN TARİH DİLİ — saf yardımcılar (bkz. __tests__/taskFormDates.test.ts).

  Form tarihi eskiden ham 'YYYY-MM-DD' olarak gösteriyor ve gün gün ▲/▼ ile seçtiriyordu:
  "gelecek pazartesi" için beş dokunuş. Todoist ve Things aynı soruyu dört kısayolla
  çözüyor (Bugün · Yarın · Hafta sonu · Gelecek hafta); takvim yalnız istisna için.
  Hepsi YEREL gün — bkz. dateKey.ts'teki UTC uyarısı.
*/

export type QuickDateKey = 'today' | 'tomorrow' | 'weekend' | 'nextWeek';
export interface QuickDate { key: QuickDateKey; dateKey: string }

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Kısayollar — aynı GÜNE düşen iki kısayol gösterilmez (Cuma'da "Hafta sonu" = "Yarın").
 * Hafta sonu: gelecek Cumartesi (hafta sonundaysak bugün, o yüzden düşer).
 * Gelecek hafta: gelecek Pazartesi (Todoist "Next week").
 */
export function quickDates(now: Date): QuickDate[] {
  const dow = now.getDay(); // 0 Pazar … 6 Cumartesi
  const candidates: QuickDate[] = [
    { key: 'today', dateKey: toDateKey(now) },
    { key: 'tomorrow', dateKey: toDateKey(addDays(now, 1)) },
    { key: 'weekend', dateKey: toDateKey(dow === 6 || dow === 0 ? now : addDays(now, 6 - dow)) },
    { key: 'nextWeek', dateKey: toDateKey(addDays(now, ((8 - dow) % 7) || 7)) },
  ];
  const seen = new Set<string>();
  return candidates.filter((c) => !seen.has(c.dateKey) && !!seen.add(c.dateKey));
}

const RELATIVE = {
  tr: { today: 'Bugün', tomorrow: 'Yarın', yesterday: 'Dün' },
  en: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' },
} as const;

/** Okunur tarih: Bugün / Yarın / Dün · önümüzdeki 6 gün gün adıyla · sonrası "15 Kas" (başka yılsa yıl da). */
export function dueDateLabel(dateKey: string, now: Date, lang: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateKey)) return '';
  const target = parseDateKey(dateKey);
  if (isNaN(target.getTime())) return '';
  const l = langOf(lang);
  const locale = localeOf(lang);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return RELATIVE[l].today;
  if (diff === 1) return RELATIVE[l].tomorrow;
  if (diff === -1) return RELATIVE[l].yesterday;
  if (diff > 1 && diff < 7) return target.toLocaleDateString(locale, { weekday: 'long' });
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (target.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return target.toLocaleDateString(locale, opts);
}

/** Saat etiketi — Türkçede 24 saat ("09:00"), İngilizcede yerel düzen ("9:00 AM"). */
export function dueTimeLabel(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });
}

const atHour = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };

/**
 * Hatırlatıcı açılınca eksik tarih/saati doldurur — formdaki eski satır içi kuralların
 * BİREBİR aynısı (testte dal dal sabitlendi), yalnız yeri değişti:
 *  · ikisi de yok   → 09:00'dan önceyse bugün 09:00, sonraysa yarın 09:00
 *  · tarih var      → ileri günse 09:00; bugünse bir sonraki tam saat (23'ü geçerse yarın 09:00)
 *  · saat var       → o saat bugün geçtiyse yarın, geçmediyse bugün
 */
export function defaultReminderSlot<T extends { dueDate: string; dueTime: string | null }>(f: T, now: Date): Pick<T, 'dueDate' | 'dueTime'> {
  if (f.dueTime && f.dueDate) return { dueDate: f.dueDate, dueTime: f.dueTime };
  if (f.dueTime) {
    const t = new Date(f.dueTime);
    const target = new Date(now);
    target.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return { dueDate: toDateKey(target < now ? addDays(now, 1) : now), dueTime: f.dueTime };
  }
  if (!f.dueDate) {
    return now.getHours() < 9
      ? { dueDate: toDateKey(now), dueTime: atHour(9) }
      : { dueDate: toDateKey(addDays(now, 1)), dueTime: atHour(9) };
  }
  const target = parseDateKey(f.dueDate);
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target > todayZero) return { dueDate: f.dueDate, dueTime: atHour(9) };
  const nextHour = now.getHours() + 1;
  if (nextHour > 23) return { dueDate: toDateKey(addDays(now, 1)), dueTime: atHour(9) };
  return { dueDate: f.dueDate, dueTime: atHour(nextHour) };
}

/** Kapatırken "değişiklikler atılsın mı?" sorulmalı mı — yalnız boşluk yazmak değişiklik sayılmaz. */
export function isFormDirty(form: object, initial: object): boolean {
  const norm = (f: object) => JSON.stringify(f, (_k, v) => (typeof v === 'string' ? v.trim() : v));
  return norm(form) !== norm(initial);
}

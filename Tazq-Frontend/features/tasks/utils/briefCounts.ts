import { calendarDayOf, toDateKey } from '@/shared/utils/dateKey';
import { isSomeday } from '@/features/tasks/utils/taskTags';
import { wantsReminder } from '@/features/tasks/utils/recurrenceInterval';

/**
 * ÖZET BİLDİRİMLERİNİN SAYILARI — tek tanım.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Kullanıcı sabah "Bugün 16 görevin var" aldı; hesapta o an bugüne kadar vadesi
 * gelmiş açık iş 4 taneydi. Sebepler:
 *  · Sabah özeti HER GÜN TEKRAR eden bir bildirimdi ama metni kurulduğu andaki sayıyla
 *    donuyordu: uygulama açılmadığı sürece her sabah aynı eski sayı geliyordu.
 *  · Akşamın "yarın için hazır" sayısı BÜTÜN açık görevleri sayıyordu — aylar sonrası
 *    ve rafa kalkmış işler dahil.
 * Sayılar artık bildirimin ÇALACAĞI GÜNE göre, bu tanımla hesaplanıyor; bildirim tek
 * seferlik kuruluyor ve sayı değişince yeniden kuruluyor.
 */

export interface BriefTask {
  id: number;
  title?: string;
  isCompleted: boolean;
  isArchived?: boolean;
  dueDate?: string | null;
  dueTime?: string | null;
  completedAt?: string | null;
  tags?: string[] | null;
}

/** O güne kadar (dahil) vadesi gelmiş AÇIK işler — ana sayfanın "bugün" listesiyle aynı tanım. */
export function openThrough(tasks: BriefTask[], dayKey: string): number {
  let n = 0;
  for (const t of tasks) {
    if (!t || t.isCompleted || t.isArchived || isSomeday(t)) continue;
    const day = calendarDayOf(t.dueDate);
    if (day && day <= dayKey) n += 1;
  }
  return n;
}

/** O gün tamamlanan işler (sunucu completedAt tutmadığı için yedek: vade günü). */
export function completedOn(tasks: BriefTask[], dayKey: string): number {
  let n = 0;
  for (const t of tasks) {
    if (!t?.isCompleted) continue;
    const when = calendarDayOf(t.completedAt) ?? calendarDayOf(t.dueDate);
    if (when === dayKey) n += 1;
  }
  return n;
}

/** Bugün o saat geçmediyse bugün, geçtiyse yarın. */
export function nextAt(now: Date, hour: number, minute = 0): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Hatırlatıcısı kurulması gereken görevler — en yakından uzağa, en fazla `limit`.
 *
 * Tekrarlı görevin bir sonraki örneği SUNUCUDA oluşuyor ve telefona indiğinde ona kimse
 * hatırlatıcı kurmuyordu: hatırlatıcılı aylık bir ödeme ilk aydan sonra susuyordu.
 * Bu liste görevler her değiştiğinde yeniden kuruluyor (aynı kimlikle kurmak eskisinin
 * üstüne yazar). Sınır, iOS'un bekleyen bildirim tavanının (64) altında kalmak için.
 */
export function reminderTasks<T extends BriefTask>(tasks: T[], limit = 40): T[] {
  return tasks
    .filter((t) => t && !t.isCompleted && !t.isArchived && wantsReminder(t.tags) && !!calendarDayOf(t.dueDate))
    .sort((a, b) => `${calendarDayOf(a.dueDate)}${a.dueTime ?? ''}`.localeCompare(`${calendarDayOf(b.dueDate)}${b.dueTime ?? ''}`))
    .slice(0, limit);
}

/**
 * Özetlerin ve hatırlatıcıların bağlı olduğu her şeyin kısa izi. Yalnız bu değişince
 * bildirimler yeniden kurulur — her görev düzenlemesinde değil.
 */
export function notificationSignature(tasks: BriefTask[], now: Date = new Date()): string {
  const today = toDateKey(now);
  const tomorrow = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const reminders = reminderTasks(tasks).map((t) => `${t.id}:${calendarDayOf(t.dueDate)}:${t.dueTime ?? ''}:${t.title ?? ''}`).join(',');
  return [today, openThrough(tasks, today), openThrough(tasks, tomorrow), completedOn(tasks, today), reminders].join('|');
}

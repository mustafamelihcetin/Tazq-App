import { understand, categoryTag, type Lang } from '@/features/tasks/nlp/understand';

/**
 * GÖREV CÜMLESİ AYRIŞTIRICI — uygulamanın her giriş noktasının kullandığı TEK yol.
 *
 * Asıl iş Anlama Motorunda (features/tasks/nlp): deterministik, cihazda, sıfır
 * maliyet. Bu dosya ekranların beklediği biçime çevirir.
 *
 * ── ESKİ HÂLDEN KALDIRILANLAR ─────────────────────────────────────────────────
 *  · "Esprili mesaj" (`wittyMessage`): her cümleye bir yorum ekliyordu ve çoğu
 *    yanıltıcıydı — tarihsiz her göreve "not defterime kaydettim" diyordu, görev
 *    not değilken. Kullanıcıya ne anlaşıldığını ÇİPLER söylüyor.
 *  · Duygu bağlamı (`context`) ve konudan öncelik tahmini: "toplantı" → düşük
 *    öncelik gibi, kullanıcının hiç söylemediği sonuçlar üretiyordu.
 *  · İkinci bir kategori motoru (taskIntelligence) kayıt anında GİZLİCE etiket
 *    ekliyor, kullanıcının sildiği etiketi her kayıtta geri getiriyordu.
 */

export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface ParsedHint {
  priority?: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  recurrence?: RecurrenceType;
  /**
   * Haftalık tekrarın günü — 0=Pazar … 6=Cumartesi (Date.getDay ile aynı).
   *
   * Eskiden burada `recurrenceDayLabel: string` vardı ve ayrıştırıcı gün adını
   * GİRDİNİN dilinde sabitliyordu: arayüzü İngilizce olan biri "her salı" yazınca
   * ipucunda "Salı", Türkçe arayüzde "every monday" yazınca "Monday" görüyordu.
   * Ayrıştırıcının işi anlamı çıkarmak, metni biçimlendirmek değil — ad, gösterildiği
   * yerde ve GÖSTERİLDİĞİ dilde üretilir (bkz. TaskFormModal).
   */
  recurrenceDay?: number;
}

/** Hatırlatma niyetinin etiketi — bildirim kurmayı bu etiket tetikliyor. */
export const REMINDER_TAG: Record<Lang, string> = { tr: 'hatırlatıcı', en: 'reminder' };
const NOTE_TAG: Record<Lang, string> = { tr: 'not', en: 'note' };

export function parseTaskHint(text: string, preferredLang?: Lang, now: Date = new Date()): ParsedHint {
  if (!text.trim()) return {};
  const u = understand(text, preferredLang, now);
  const hint: ParsedHint = {};
  if (u.priority) hint.priority = u.priority;
  if (u.dueDate) hint.dueDate = u.dueDate;
  if (u.dueTime) hint.dueTime = u.dueTime;
  if (u.recurrence) hint.recurrence = u.recurrence;
  if (u.recurrenceDay != null) hint.recurrenceDay = u.recurrenceDay;
  const tags = [
    ...(u.category ? [categoryTag(u.category, u.lang)] : []),
    ...(u.reminder ? [REMINDER_TAG[u.lang]] : []),
    ...(u.note ? [NOTE_TAG[u.lang]] : []),
  ];
  if (tags.length) hint.tags = tags;
  return hint;
}

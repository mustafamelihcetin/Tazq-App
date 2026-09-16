import { toDateKey } from '@/shared/utils/dateKey';
import type { Priority } from '@/shared/services/api';

/**
 * "HER İKİ GÜNDE BİR" — başlıktan tekrar aralığı okuma.
 *
 * Kullanıcı görevin tekrarını bir açılır menüden seçebiliyor, ama çoğu kişi bunu
 * doğrudan başlığa yazıyor: "iki günde bir su iç", "every 3 days". Bu ayrıştırıcı o
 * cümleyi anlayıp görev tamamlandığında bir SONRAKİ örneği kuruyor.
 *
 * ── NEDEN AYRI DOSYA ──────────────────────────────────────────────────────────
 * Mantık 2500 satırlık ekranın içine gömülüydü ve test edilemiyordu. Nitekim içinde
 * Türkçeye özgü, ancak testle yakalanabilecek bir kusur yaşıyordu (aşağıya bkz.).
 */

const TR_NUMBERS: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, dort: 4, dört: 4, bes: 5, beş: 5,
  alti: 6, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
};
const EN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/*
  Desenler REGEX SABİTİ olarak yazılıyor, dizeden kurulmuyor.

  `new RegExp('...' + word + '...')` hâli okunaklı görünüyordu ama kaçış karakterleri
  iki kez yorumlanıyor (\\s → \s → s) ve bir yanlış kaçışta desen SESSİZCE
  bozuluyor: eşleşme olmuyor, hata da olmuyor. Sabit yazımda böyle bir katman yok.

  Sayı seçenekleri iki kez geçiyor (gün/hafta/ay) — tekrar, sessizce bozulabilen bir
  soyutlamaya yeğlenir.
*/
const PATTERNS: Array<{ re: RegExp; unit: 'day' | 'week' | 'month' }> = [
  { re: /(?:her\s+)?(bir|iki|üç|dort|dört|bes|beş|alti|altı|yedi|sekiz|dokuz|on|\d+)\s+günde\s+bir/, unit: 'day' },
  { re: /every\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+days/, unit: 'day' },
  { re: /(?:her\s+)?(bir|iki|üç|dort|dört|bes|beş|alti|altı|yedi|sekiz|dokuz|on|\d+)\s+haftada\s+bir/, unit: 'week' },
  { re: /every\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+weeks/, unit: 'week' },
  { re: /(?:her\s+)?(bir|iki|üç|dort|dört|bes|beş|alti|altı|yedi|sekiz|dokuz|on|\d+)\s+ayda\s+bir/, unit: 'month' },
  { re: /every\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+months/, unit: 'month' },
];

/**
 * Başlığı karşılaştırmaya hazırlar.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Burada `toLowerCase()` kullanılıyordu ve Türkçede kalıpları KAÇIRIYOR: 'İ' harfi
 * 'i' değil, 'i' + birleşen nokta (U+0307) olur. "İki günde bir" → 'i̇ki günde bir'
 * ve desendeki düz 'iki' ile eşleşmez.
 *
 * Sonuç, kullanıcının nasıl YAZDIĞINA bağlı bir hataydı: küçük harfle yazanda
 * tekrarlayan görev üretiliyor, cümle başını büyük harfle yazanda hiç üretilmiyordu.
 * Böyle bir hata kullanıcıya "bazen çalışıyor" diye görünür — en zor bildirileni.
 *
 * Türkçe yerel doğru sonucu veriyor ('İ' → 'i'); İngilizce anahtar kelimelerin
 * hiçbirinde 'I' geçmediği için ('every', 'days', 'one'…'ten', 'other') bu yerel
 * İngilizce başlıkları bozmuyor.
 */
export function normalizeTitle(title: unknown): string {
  return String(title ?? '').toLocaleLowerCase('tr');
}

/** Sayı sözcüğünü ya da rakamı çözer; tanınmayan değer 1 sayılır. */
function toCount(raw: string): number {
  const v = raw.toLocaleLowerCase('tr');
  if (/^[0-9]+$/.test(v)) {
    const n = parseInt(v, 10);
    // Saçma bir aralık ("her 9999 günde bir") takvimi taşırmasın.
    return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 1;
  }
  return TR_NUMBERS[v] ?? EN_NUMBERS[v] ?? 1;
}

export interface Interval { count: number; unit: 'day' | 'week' | 'month' }

/** Başlıkta bir tekrar aralığı var mı? Yoksa null. */
export function parseIntervalFromTitle(title: unknown): Interval | null {
  const lower = normalizeTitle(title);
  for (const { re, unit } of PATTERNS) {
    const m = lower.match(re);
    if (m) return { count: toCount(m[1]), unit };
  }
  // "gün aşırı" / "every other day" → iki günde bir
  if (lower.includes('gün aşırı') || lower.includes('every other day')) {
    return { count: 2, unit: 'day' };
  }
  return null;
}

/** Aralığı bir tarihe uygular (verilen tarihi DEĞİŞTİRMEZ). */
export function addInterval(from: Date, { count, unit }: Interval): Date {
  const d = new Date(from);
  if (unit === 'day') d.setDate(d.getDate() + count);
  else if (unit === 'week') d.setDate(d.getDate() + count * 7);
  else d.setMonth(d.getMonth() + count);
  return d;
}

export interface NextInstanceTask {
  title?: string;
  description?: string | null;
  dueTime?: string | null;
  priority?: Priority | string | null;
  tags?: string[] | null;
  subtasks?: { text: string }[] | null;
}

/**
 * Tamamlanan görevden bir SONRAKİ örneği kurar; başlıkta aralık yoksa null.
 *
 * `recurrence: 'None'` bilinçli: zincir BAŞLIKTAN sürüyor, ayrı bir tekrar alanından
 * değil. İki mekanizma aynı anda çalışsaydı her tamamlamada iki görev üretilirdi.
 */
export function buildNextIntervalInstance(task: NextInstanceTask, now: Date = new Date()) {
  const interval = parseIntervalFromTitle(task?.title);
  if (!interval) return null;

  return {
    title: task.title as string,
    description: task.description || '',
    dueDate: toDateKey(addInterval(now, interval)),
    dueTime: task.dueTime || null,
    isCompleted: false,
    /*
      Öncelik DARALTILIYOR: gelen kayıt eski/bozuk bir değer taşıyabiliyor (diskten
      ya da sunucudan). Tip olarak `Priority` vaat edip serbest bir dize geçirmek,
      hatayı bu dosyadan çıkarıp çağıranın içine taşır.
    */
    priority: (task.priority === 'Low' || task.priority === 'High' ? task.priority : 'Medium') as Priority,
    tags: task.tags || [],
    // Alt görevler TAŞINIR ama işaretleri sıfırlanır: yeni örnek baştan yapılacak.
    subtasks: (task.subtasks || []).map((s) => ({ text: s.text, done: false })),
    recurrence: 'None' as const,
  };
}

/** Bu görevin bir hatırlatıcısı var mı (etiketten okunur — formun sözleşmesi bu). */
export function wantsReminder(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => t === 'hatırlatıcı' || t === 'reminder');
}

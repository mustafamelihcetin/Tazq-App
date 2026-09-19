import { calendarDayOf, parseDateKey, toDateKey } from '@/shared/utils/dateKey';
import { weekdayName } from '@/shared/constants/weekdays';
import type { AppLang } from '@/shared/utils/lang';

/**
 * UFUK — Görevler listesinde neyin açık, neyin katlı duracağı.
 *
 * ── ÖNCEKİ HÂL ────────────────────────────────────────────────────────────────
 * "İleri Tarihli Eklenenleri Göster" diye bir anahtar vardı. Açıkken aylar sonrası
 * listeyi dolduruyordu; kapalıyken kullanıcı YARIN için eklediği görevi kaydeder
 * kaydetmez göremiyordu — "eklendi mi, kayboldu mu?" Bir anahtar iki kötü seçenek
 * arasında seçim yaptırıyordu.
 *
 * ── ŞİMDİ: GİZLEME YOK, KATLAMA VAR ───────────────────────────────────────────
 * Önümüzdeki 7 gün (gecikmiş, bugün, tarihsiz dahil) listede açık. Daha sonrası
 * listenin sonunda tek satır: "Daha sonra · N görev" — dokununca açılır. Uzak iş
 * ekranı doldurmaz ama kaybolmaz da. Ayar yok, karar yok.
 *
 * Tekrarlayan görevler zaten bir sorun değil: bir sonraki örnek, öncekini
 * tamamlayınca oluşuyor — listede her zaman TEK bir kopya durur.
 */

/** Açık duran ufuk: bugünden itibaren kaç gün. */
export const NEAR_DAYS = 7;

interface HorizonTask { isCompleted: boolean; dueDate?: string | null }

const plusDays = (now: Date, n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);

/** Görev açık ufkun ÖTESİNDE mi? Tamamlanan ve tarihsiz görevler hiçbir zaman değil. */
export function isLater(t: HorizonTask, now: Date = new Date()): boolean {
  if (t.isCompleted) return false;
  const day = calendarDayOf(t.dueDate);
  return !!day && day > toDateKey(plusDays(now, NEAR_DAYS));
}

/** Sırayı bozmadan ikiye ayırır. */
export function splitByHorizon<T extends HorizonTask>(tasks: T[], now: Date = new Date()): { near: T[]; later: T[] } {
  const near: T[] = [];
  const later: T[] = [];
  for (const t of tasks) (isLater(t, now) ? later : near).push(t);
  return { near, later };
}

const MONTHS: Record<AppLang, string[]> = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const COPY = {
  tr: {
    tomorrow: 'Yarın',
    date: (day: number, month: string) => `${day} ${month}`,
    added: (when: string) => `${when} için eklendi`,
    // Cümle içinde "Yarın" küçük yazılır; gün ve ay adları büyük kalır.
    titled: (title: string, when: string) => `"${title}" ${when === 'Yarın' ? 'yarın' : when} için eklendi.`,
    showLater: (n: number) => `Daha sonra · ${n} görev`,
    hideLater: 'Daha sonrakileri gizle',
    emptyTitle: `Önümüzdeki ${NEAR_DAYS} gün boş`,
    emptyBody: (n: number) => `İleri tarihli ${n} görevin aşağıda.`,
  },
  en: {
    tomorrow: 'Tomorrow',
    date: (day: number, month: string) => `${month} ${day}`,
    added: (when: string) => `Added for ${when}`,
    titled: (title: string, when: string) => `"${title}" added for ${when === 'Tomorrow' ? 'tomorrow' : when}.`,
    showLater: (n: number) => `Later · ${n} tasks`,
    hideLater: 'Hide later tasks',
    emptyTitle: `Next ${NEAR_DAYS} days are clear`,
    emptyBody: (n: number) => `${n} later tasks below.`,
  },
};

export const horizonCopy = (lang: AppLang) => COPY[lang];

/**
 * Görev ne zamana düştü — yalnız bugünden SONRA ise: "Yarın", "Cuma", "25 Eylül".
 * Bugün, geçmiş ya da tarihsiz → null (söylenecek bir şey yok: görev zaten önünde).
 */
export function whenLabel(dueDate: string | null | undefined, lang: AppLang, now: Date = new Date()): string | null {
  const day = calendarDayOf(dueDate);
  if (!day || day <= toDateKey(now)) return null;
  if (day === toDateKey(plusDays(now, 1))) return COPY[lang].tomorrow;
  const d = parseDateKey(day);
  if (day <= toDateKey(plusDays(now, 6))) return weekdayName(d.getDay(), lang);
  return COPY[lang].date(d.getDate(), MONTHS[lang][d.getMonth()]);
}

import { fmtDateKey } from '@/features/habits';

/**
 * SERİNİN GÜN HESABI — tek bir "bugün" tanımı.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Ana ekran aynı soruyu ("kullanıcı bugün bir şey yaptı mı") üç ayrı biçimde
 * soruyordu ve üçü de farklı bir günü kastediyordu:
 *
 *   · Alışkanlıklar `fmtDateKey()` ile yazılıyor  → "2026-09-15", 3 saat GECE KUŞU
 *     tamponlu (gece 02:00 hâlâ önceki gün sayılır — ürünün kendi gün tanımı).
 *   · Odak mağazası `getLocalDateString()` kullanıyor → aynı biçim, aynı tampon.
 *   · Seri hesabı ise `new Date().toDateString()` → "Mon Sep 15 2026", TAMPONSUZ.
 *
 * İki somut sonucu vardı:
 *
 *  1. ODAK SEANSLARI SERİYE HİÇ SAYILMIYORDU. Karşılaştırma
 *     `dailyFocusDate === todayStr` biçiminde yazılmıştı: solda "2026-09-15",
 *     sağda "Mon Sep 15 2026". Bu koşul HİÇBİR ZAMAN doğru olmaz. Yani yalnız odak
 *     çalışan bir kullanıcı seri kazanmıyor, üstelik dün yalnız odaklanmışsa
 *     ertesi gün kalkanı harcanıyor ya da serisi sıfırlanıyordu.
 *
 *  2. SERİ HER GECE YARISI ŞİŞİYORDU. Alışkanlık anahtarı tamponlu, gün
 *     karşılaştırması tamponsuz olduğu için saat 00:01'de "dünün alışkanlıkları"
 *     yeni günün serisini artırıyordu — geceyi uygulamada geçiren herkese her gece
 *     bedava bir seri günü.
 *
 * Bu modül tek bir gün tanımı sunuyor: ÜRÜNÜN gün tanımı (tamponlu `fmtDateKey`).
 * Karar veren kısımlar saf tutuldu ki test edilebilsinler — kusurun yaşadığı yer
 * tam olarak burasıydı ve hiçbiri test edilebilir değildi.
 */

/** Bir tarihin (ya da ISO dizesinin) ürün gün anahtarı. Geçersizse null. */
export function dayKeyOf(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : fmtDateKey(d);
}

/** Bugünün gün anahtarı. */
export function todayKey(now: Date = new Date()): string {
  return fmtDateKey(now);
}

/**
 * Gün anahtarını YEREL gece yarısına sabitlenmiş bir zaman damgasına çevirir.
 *
 * İki biçimi de kabul ediyor, çünkü diskte ESKİ kayıtlar var: bu düzeltmeden önce
 * `lastCheckedDate` alanına `toDateString()` yazılıyordu. Yalnız yeni biçimi
 * anlasaydık, güncellemeden sonraki ilk açılışta eski değer okunamaz ve "hiç kontrol
 * edilmemiş" sayılırdı — yani kullanıcının serisi güncelleme yüzünden yeniden
 * yargılanırdı. Göç, sessizce ve tek yerde.
 *
 * `new Date("2026-09-15")` UTC gece yarısı olarak çözülür; bu yüzden ISO biçimi elle
 * ayrıştırılıyor. Karışık ayrıştırma, saat dilimi kadar kayan bir gün farkı üretirdi.
 */
export function dayStamp(key: string | null | undefined): number {
  if (!key) return NaN;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const legacy = new Date(key);
  if (Number.isNaN(legacy.getTime())) return NaN;
  return new Date(legacy.getFullYear(), legacy.getMonth(), legacy.getDate()).getTime();
}

/**
 * İki gün anahtarı arasındaki TAM GÜN farkı.
 *
 * `Math.round` KULLANILIYOR, floor değil: iki uç da yerel gece yarısına sabitli ama
 * araya yaz saati geçişi girerse fark 23 ya da 25 saat olur. `floor` o günlerde
 * 1 yerine 0 döndürüp kontrolü sessizce atlıyordu.
 */
export function daysBetween(fromKey: string, toKey: string): number {
  const a = dayStamp(fromKey);
  const b = dayStamp(toKey);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Bir gün anahtarının ESKİ biçimdeki karşılığı (`toDateString()`).
 *
 * Diskte bu düzeltmeden önce yazılmış bayraklar var; göç kontrolü onlarla
 * karşılaştırma yapmak zorunda. Dikkat edilecek incelik şu: karşılaştırma
 * `new Date().toDateString()` ile YAPILAMAZ, çünkü o tamponsuzdur. Gece 01:00'de
 * ürünün günü hâlâ dündür ama `toDateString()` çoktan bugünü söyler — ikisi
 * karıştırılırsa aynı gün iki kez sayılır, yani düzeltilen kusur geri gelir.
 */
export function legacyDayString(key: string): string {
  const t = dayStamp(key);
  return Number.isNaN(t) ? '' : new Date(t).toDateString();
}

/**
 * ÜRÜNÜN hafta günü — Pazartesi 0, Pazar 6.
 *
 * Haftalık şeritte "bugün" hangi sütun? Bu soru İKİ yerde ayrı ayrı cevaplanıyordu:
 * ana ekran 3 saatlik tamponu uygulayıp sütunu seçiyor, durum merkezindeki grafik ise
 * ham `getDay()` kullanıyordu. Gece 00:00–03:00 arasında ikisi FARKLI sütunu
 * gösteriyordu: dakikalar bir çubuğa yazılıyor, "bugün" çerçevesi yanındakine
 * çiziliyordu.
 *
 * Aynı soruya iki yerde cevap verilmesi, bu turda dördüncü kez kusur üretti. Cevap
 * artık tek yerde.
 */
export function weekdayIndex(now: Date = new Date()): number {
  const key = todayKey(now);
  // Anahtar öğle vakti okunuyor ki saat dilimi gün sınırını kaydırmasın.
  const day = new Date(`${key}T12:00:00`).getDay(); // 0 = Pazar
  return day === 0 ? 6 : day - 1;                   // Pazartesi = 0
}

export interface ActivityInput {
  /** Hangi gün soruluyor. */
  dayKey: string;
  tasks: { isCompleted?: boolean; completedAt?: string | null; dueDate?: string | null }[];
  habits: { completedDates?: string[] | null }[];
  /** Odak mağazasının saydığı gün — zaten ürün biçiminde. */
  focusDate: string;
  focusMinutes: number;
  focusGoalMinutes: number;
}

/**
 * Bu görev O GÜN mü tamamlandı?
 *
 * Kural tek yerde çünkü iki ayrı soru aynı cevabı istiyor: "kullanıcı bugün aktif
 * miydi" (seri) ve "bu görev bugünün listesinde durmalı mı" (ana ekran). İkisi
 * ayrışırsa, seriye sayılan bir görev ekranda görünmeyebilir.
 */
export function wasCompletedOn(
  t: { isCompleted?: boolean; completedAt?: string | null; dueDate?: string | null } | null | undefined,
  dayKey: string,
): boolean {
  if (!t?.isCompleted) return false;
    /*
      ÖNCE `completedAt`: "ne zaman yapıldı" sorusunun tek doğru cevabı bu.
      Eski kod `dueDate`e bakıyordu, yani "vadesi bugün olan ve tamamlanmış" sayıyordu:
      üç gün önce bitirilmiş ama vadesi bugüne yazılmış bir görev, bugün hiçbir şey
      yapmamış kullanıcıya seri kazandırıyordu.

      `dueDate` yalnız YEDEK: sunucu `completedAt` tutmuyor (bkz. useTaskStore.setTasks)
      ve alan bazı kayıtlarda boş geliyor. Yedek olmasaydı düzeltme, bu kullanıcıların
      serisini kırardı — yani bir kusuru düzeltirken başka birini açardı.
    */
  const when = t.completedAt ? dayKeyOf(t.completedAt) : dayKeyOf(t.dueDate);
  return when === dayKey;
}

/** O gün tamamlanmış görev sayısı. */
export function completedTasksOn({ dayKey, tasks }: Pick<ActivityInput, 'dayKey' | 'tasks'>): number {
  return tasks.filter((t) => wasCompletedOn(t, dayKey)).length;
}

/** O gün işaretlenmiş alışkanlık sayısı. */
export function completedHabitsOn({ dayKey, habits }: Pick<ActivityInput, 'dayKey' | 'habits'>): number {
  return habits.filter((h) => (h?.completedDates ?? []).includes(dayKey)).length;
}

/** O güne ait odak dakikası (gün eşleşmiyorsa 0 — başka bir günün dakikası sayılmaz). */
export function focusMinutesOn({ dayKey, focusDate, focusMinutes }: Pick<ActivityInput, 'dayKey' | 'focusDate' | 'focusMinutes'>): number {
  return focusDate === dayKey ? focusMinutes : 0;
}

/**
 * O gün "aktif" sayılır mı? Tek bir tamamlanan görev, tek bir alışkanlık ya da
 * hedefi dolduran bir odak seansı yeter — üçü de aynı ağırlıkta.
 */
export function wasActiveOn(input: ActivityInput): boolean {
  return (
    completedTasksOn(input) > 0 ||
    completedHabitsOn(input) > 0 ||
    (input.focusGoalMinutes > 0 && focusMinutesOn(input) >= input.focusGoalMinutes)
  );
}

export type StreakVerdict =
  | { action: 'none' }
  | { action: 'protect'; daysMissed: number; shieldsLeft: number }
  | { action: 'reset'; daysMissed: number; shieldsHad: number };

/**
 * Aradan geçen günler için ne olmalı?
 *
 * Kural değişmedi, yalnız SAF hâle getirildi: bir gün kaçırıldıysa ve o gün gerçekten
 * aktifse ceza yok; değilse kalkanlar kaçırılan gün sayısı kadar harcanır, yetmezse
 * seri sıfırlanır.
 */
export function decideStreak(input: {
  daysMissed: number;
  metGoalOnMissedDay: boolean;
  currentStreak: number;
  shields: number;
}): StreakVerdict {
  const { daysMissed, metGoalOnMissedDay, currentStreak, shields } = input;
  if (daysMissed <= 0) return { action: 'none' };
  if (currentStreak <= 0) return { action: 'none' };
  // Tek gün kaçırıldıysa ve o gün aktifse kayıp yok — gün zaten yaşanmış.
  if (daysMissed === 1 && metGoalOnMissedDay) return { action: 'none' };
  if (shields >= daysMissed) return { action: 'protect', daysMissed, shieldsLeft: shields - daysMissed };
  return { action: 'reset', daysMissed, shieldsHad: shields };
}

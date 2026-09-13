/**
 * BİR MODUN PLAN İLERLEYİŞİ — "bugün ne var" sorusunun tek doğru cevabı.
 *
 * ── ÖLÇÜLEN HATA ──────────────────────────────────────────────────────────────
 * Bugünün plan görevleri şöyle sayılıyordu:
 *
 *     tasks.filter(t => planIds.includes(t.id) && t.tags.includes('daily') && isToday(t.dueDate))
 *
 * `daily` etiketi YALNIZCA günlük plan motorunun ürettiği görevlerde var. Mod
 * kurulurken oluşan görevler (ör. "3 aylık milestone planı yap") o etiketi almıyor;
 * etiketleri modun kendi adı oluyor ve yüksek öncelikliler BUGÜNE kuruluyor
 * (bkz. TurkishModeBanner → getTaskDueDate).
 *
 * Sonuç kullanıcıya şöyle görünüyordu: ana ekranda "bugün plan görevin yok",
 * Görevler ekranında ise o görevler duruyor. İki ekran aynı soruya farklı cevap
 * verince güvenilen ekran kalmıyor.
 *
 * Doğru soru "bu görevi hangi motor üretti" değil, "bugüne kurulmuş mu".
 *
 * ── NEDEN AYRI VE SAF ─────────────────────────────────────────────────────────
 * Hesap bir hook'un içinde gömülüyken test edilemiyordu (store, tema, dil bağımlılığı).
 * Burada saf: girdi görev listesi, çıktı sayılar. Bkz. __tests__/planProgress.test.ts
 */

export interface PlanTaskLike {
  id: number;
  isCompleted?: boolean;
  dueDate?: string | null;
  tags?: string[] | null;
}

export interface PlanProgress {
  /** Bugüne kurulmuş plan görevi sayısı (etiketten BAĞIMSIZ). */
  todayTotal: number;
  /** Bunların kaçı bitti. */
  todayDone: number;
  /** Tarihi ne olursa olsun HENÜZ bitmemiş plan görevleri. */
  openTotal: number;
  /** Plana ait, hâlâ var olan toplam görev sayısı. */
  taskTotal: number;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Bir görev bugüne mi kurulmuş? Tarihsiz görev "bugün" sayılmaz. */
function isDueToday(dueDate: string | null | undefined, now: Date): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return false;
  return isSameDay(d, now);
}

export function planProgressFor(
  tasks: PlanTaskLike[],
  planTaskIds: number[],
  now: Date = new Date(),
): PlanProgress {
  const ids = new Set(planTaskIds);
  const planTasks = tasks.filter(t => ids.has(t.id));
  const todays = planTasks.filter(t => isDueToday(t.dueDate, now));

  return {
    todayTotal: todays.length,
    todayDone: todays.filter(t => t.isCompleted).length,
    openTotal: planTasks.filter(t => !t.isCompleted).length,
    taskTotal: planTasks.length,
  };
}

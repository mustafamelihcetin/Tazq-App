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

import { isDueToday as isHabitDueToday, type HabitLike } from '@/features/habits/utils/habitSchedule';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';
import { calendarDayOf, toDateKey } from '@/shared/utils/dateKey';

export interface PlanTaskLike {
  id: number;
  isCompleted?: boolean;
  dueDate?: string | null;
  tags?: string[] | null;
}

/** "Bugün" burada YOK — tek tanımı aşağıda: modeToday (görev + bugün planlı alışkanlık). */
export interface PlanProgress {
  /** Tarihi ne olursa olsun HENÜZ bitmemiş plan görevleri. */
  openTotal: number;
  /** Plana ait, hâlâ var olan toplam görev sayısı. */
  taskTotal: number;
}

export function planProgressFor(tasks: PlanTaskLike[], planTaskIds: number[]): PlanProgress {
  const ids = new Set(planTaskIds);
  const planTasks = tasks.filter(t => ids.has(t.id));

  return {
    openTotal: planTasks.filter(t => !t.isCompleted).length,
    taskTotal: planTasks.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODUN BUGÜNÜ — görev + alışkanlık, tek tanım (2026-10-31, yeniden düzenleme Y-1)
// ─────────────────────────────────────────────────────────────────────────────

/*
  Cihazda görüldü: ana sayfa aynı mod için "0/2 plan görevi", Hedefler "0/3" diyordu. "Bugün"
  dört yerde ayrı sayılıyordu — özet kancası yalnız görev, Hedefler + mod kartları + yol haritası
  rozeti görev + modun BÜTÜN alışkanlıkları (dinlenen ve o gün planlı olmayan dahil).

  Tek tanım:
   · Görev: bugüne kurulmuş YA DA bugün bitirilmiş (erken bitirilen iş bugünün emeğidir).
     Gün TAKVİM günüdür, tamponsuz (calendarDayOf — sunucunun saf gün biçimi UTC'ye kaymaz).
   · Alışkanlık: BUGÜN PLANLI olan (habitSchedule.isDueToday — dinlenen yok, gün planına uyar);
     bitti = bugünün anahtarı completedDates'te. Gün fmtDateKey: gece kuşu tamponlu (01:00 hâlâ dün).
  Bu ayrım mod kartlarında zaten vardı (bkz. ExamCard "GÖREV GÜNÜ ≠ ALIŞKANLIK GÜNÜ").
*/

export interface TodayTaskLike extends PlanTaskLike {
  completedAt?: string | null;
}

export interface TodayHabitLike extends HabitLike {
  id: string;
}

export function modeToday(input: {
  tasks: TodayTaskLike[];
  habits: TodayHabitLike[];
  planTaskIds: number[];
  planHabitIds: string[];
  now?: Date;
}): { done: number; total: number } {
  const now = input.now ?? new Date();
  const calToday = toDateKey(now);
  const habitToday = fmtDateKey(now);
  const onToday = (d?: string | null) => calendarDayOf(d) === calToday;
  const taskIds = new Set(input.planTaskIds);
  const habitIds = new Set(input.planHabitIds);

  const todays = input.tasks.filter(t => taskIds.has(t.id)
    && (onToday(t.dueDate) || (!!t.isCompleted && onToday(t.completedAt))));
  const dueHabits = input.habits.filter(h => habitIds.has(h.id) && isHabitDueToday(h, habitToday));

  return {
    done: todays.filter(t => t.isCompleted).length + dueHabits.filter(h => (h.completedDates ?? []).includes(habitToday)).length,
    total: todays.length + dueHabits.length,
  };
}

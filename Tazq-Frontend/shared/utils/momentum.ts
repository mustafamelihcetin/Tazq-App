// Momentum skoru — saf, test edilebilir hesap.
// index.tsx içindeki "tanrı bileşeni" mantığından çıkarıldı; davranış BİREBİR korunmuştur.
// Tasarım notları (gaming önleme) korunur:
//  • Öncelik ağırlığı High=3 / Medium=2 / Low=1 → tek kolay görevle skor şişmesin.
//  • Recency decay: bugün %100 → her gün %10 düşer, 7. günde %30 taban.
//  • Streak'te 14 günden sonra azalan getiri (saf streak-gaming'i sınırlar).
//  • Habit bileşeni çağıran tarafça BUGÜN HARİÇ verilir (sonsuz salınımı önler).

export interface MomentumTaskLike {
  priority?: string;
  isCompleted?: boolean;
  dueDate?: string | null;
}

export interface MomentumInput {
  tasks: MomentumTaskLike[];
  weeklyFocus: { minutes?: number }[];
  weeklyMinutes: number;
  streak: number;
  habitActivityDays: number; // 0..7, BUGÜN hariç son 7 günde aktif gün sayısı
  now?: Date;
}

export interface MomentumResult {
  momentum: number;
  totalCount: number;
  completedCount: number;
  weightedCompletion: number;
  focusScore: number;
  focusVolumeScore: number;
  streakScore: number;
  habitScore: number;
}

const PRIORITY_WEIGHTS: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('T')[0].split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
}

export function computeMomentum(input: MomentumInput): MomentumResult {
  const now = input.now ?? new Date();

  // Respect the 3-hour night-owl buffer
  const logicalToday = new Date(now);
  logicalToday.setHours(logicalToday.getHours() - 3);
  logicalToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(logicalToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyTasks = input.tasks.filter(t => {
    if (!t.dueDate) return false;
    const taskDate = parseLocalDate(t.dueDate);
    return taskDate >= sevenDaysAgo;
  });
  const totalCount = weeklyTasks.length;
  const completedCount = weeklyTasks.filter(t => t.isCompleted).length;

  // Öncelik-ağırlıklı, recency-azalmalı tamamlanma oranı.
  const weightedCompletion = (() => {
    if (weeklyTasks.length === 0) return 0;
    let earnedPts = 0;
    let totalPts = 0;
    for (const task of weeklyTasks) {
      const taskDate = task.dueDate ? parseLocalDate(task.dueDate) : new Date(logicalToday);
      const daysAgo = Math.round((logicalToday.getTime() - taskDate.getTime()) / 86400000);
      const recency = Math.max(0.3, 1 - Math.max(0, daysAgo) * 0.1);
      const weight = (PRIORITY_WEIGHTS[task.priority ?? 'Low'] || 1) * recency;
      totalPts += weight;
      if (task.isCompleted) earnedPts += weight;
    }
    return totalPts > 0 ? earnedPts / totalPts : 0;
  })();

  // Odak: hacim (toplam dk) %60 + tutarlılık (kaç güne yayıldı) %40.
  const focusActiveDays = input.weeklyFocus.filter(d => (d.minutes || 0) >= 10).length;
  const focusVolumeScore = Math.min(input.weeklyMinutes / 280, 1);
  const focusConsistencyScore = focusActiveDays / 7;
  const focusScore = focusVolumeScore * 0.6 + focusConsistencyScore * 0.4;

  // Streak: 14 güne kadar lineer, sonrası küçük bonus (max 1.15x).
  const streakScore = input.streak <= 14
    ? Math.min(input.streak / 14, 1)
    : 1 + Math.min((input.streak - 14) / 28, 0.15);

  const habitScore = input.habitActivityDays / 7;

  // Nihai ağırlıklı skor (0-100): Tamamlama %38 | Odak %32 | Streak %20 | Habit %10.
  const rawMomentum = weightedCompletion * 38 + focusScore * 32 + Math.min(streakScore, 1.15) * 20 + habitScore * 10;
  const momentum = Math.min(100, Math.round(rawMomentum));

  return { momentum, totalCount, completedCount, weightedCompletion, focusScore, focusVolumeScore, streakScore, habitScore };
}

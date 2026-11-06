import { logicalNow } from '@/shared/utils/appDay';
// Momentum skoru — saf, test edilebilir hesap.
// index.tsx içindeki "tanrı bileşeni" mantığından çıkarıldı; davranış BİREBİR korunmuştur.
// Tasarım notları (gaming önleme) korunur:
//  • Öncelik ağırlığı High=3 / Medium=2 / Low=1 → tek kolay görevle skor şişmesin.
//  • Recency decay: bugün %100 → her gün %10 düşer, 7. günde %30 taban.
//  • Streak'te 14 günden sonra azalan getiri (saf streak-gaming'i sınırlar).
//  • 2026-11-06: görev bitirildiği güne göre sayılır; ileri tarihli iş skoru düşürmez, tarihsiz iş bitince sayılır.
//  • 2026-11-06: alışkanlık payı gerçek alışkanlık oranıdır (eskiden uygulamanın açıldığı gün sayısıydı). Alışkanlığı olmayanda pay diğerlerine dağılır.

export interface MomentumTaskLike {
  id?: string | number;
  priority?: string;
  isCompleted?: boolean;
  dueDate?: string | null;
  completedAt?: string | null;
  ignoreMomentum?: boolean;
}

export interface MomentumInput {
  tasks: MomentumTaskLike[];
  weeklyFocus: { minutes?: number }[];
  weeklyMinutes: number;
  streak: number;
  /** Son 7 günde yapılan / beklenen alışkanlık (0..1). Alışkanlık yoksa null. */
  habitRatio: number | null;
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

/** Tek kaynak: hesap da bilgi penceresi de buradan okur. */
export const MOMENTUM_WEIGHTS = { tasks: 38, focus: 32, streak: 20, habits: 10 } as const;

const PRIORITY_WEIGHTS: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('T')[0].split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
}

export function computeMomentum(input: MomentumInput): MomentumResult {
  const now = input.now ?? new Date();

  // Respect the 3-hour night-owl buffer
  const logicalToday = logicalNow(now);
  logicalToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(logicalToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  /*
    Görevin günü: bitmişse bitirildiği gün (yoksa vade), bitmemişse vade. Pencere son 7 gün; bugünden ileri hiçbir şey sayılmaz.
    `now`dan sonra bitirilen görev o gün henüz bitmemiş demektir (geçmiş günün skoru için).
  */
  const dayOfTask = (t: MomentumTaskLike): { day: Date; done: boolean } | null => {
    const finished = t.isCompleted && t.completedAt ? new Date(t.completedAt) : null;
    if (finished && !Number.isNaN(finished.getTime())) {
      const day = new Date(finished.getFullYear(), finished.getMonth(), finished.getDate());
      if (day <= logicalToday) return { day, done: true };
    } else if (t.isCompleted && t.dueDate) {
      return { day: parseLocalDate(t.dueDate), done: true };
    }
    return t.dueDate ? { day: parseLocalDate(t.dueDate), done: false } : null;
  };
  const counted = input.tasks
    .map(t => ({ task: t, at: dayOfTask(t) }))
    .filter((x): x is { task: MomentumTaskLike; at: { day: Date; done: boolean } } => !!x.at && x.at.day >= sevenDaysAgo && x.at.day <= logicalToday);
  const weeklyTasks = counted.map(x => x.task);
  const totalCount = weeklyTasks.length;
  const completedCount = counted.filter(x => x.at.done).length;

  /*
    "Velocity Guard" KALDIRILDI (2026-10-25): 10 sn içinde tamamlanan görev sayılmıyordu —
    uygulamanın kendi TOPLU SEÇİM özelliğiyle birden çok görevi bitiren kullanıcıyı
    cezalandırıyordu. Skor bir ORAN (kazanılan / toplam ağırlık); hızla şişirilemez.
    Eski sürümün `ignoreMomentum` işaretleri de artık yok sayılır (alan geriye dönük
    uyumluluk için tipte duruyor).
  */
  // Öncelik-ağırlıklı, recency-azalmalı tamamlanma oranı.
  const weightedCompletion = (() => {
    let earnedPts = 0;
    let totalPts = 0;
    for (const { task, at } of counted) {
      const daysAgo = Math.round((logicalToday.getTime() - at.day.getTime()) / 86400000);
      const recency = Math.max(0.3, 1 - Math.max(0, daysAgo) * 0.1);
      const weight = (PRIORITY_WEIGHTS[task.priority ?? 'Low'] || 1) * recency;
      totalPts += weight;
      if (at.done) earnedPts += weight;
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

  const habitScore = input.habitRatio ?? 0;

  // Nihai skor (0-100). Alışkanlığı olmayan %90'lık ölçekle değerlendirilir: yapamayacağı bir şeyden puan kaybetmez.
  const W = MOMENTUM_WEIGHTS;
  const earned = weightedCompletion * W.tasks + focusScore * W.focus + Math.min(streakScore, 1.15) * W.streak + habitScore * W.habits;
  const rawMomentum = input.habitRatio == null ? (earned * 100) / (100 - W.habits) : earned;
  const momentum = Math.min(100, Math.round(rawMomentum));

  return { momentum, totalCount, completedCount, weightedCompletion, focusScore, focusVolumeScore, streakScore, habitScore };
}

/**
 * BUGÜN GÖRÜNEN HAFTANIN EN İYİ GÜNÜ MÜ — momentum grafiğindeki parıltının kapısı.
 *
 * Momentum kutusu açılış animasyonundan sonra donuyordu. Buraya süs eklemek kolaydı;
 * doğrusu değildi — bu kod tabanında hareketin kuralı belli (bkz. StatusHub nabzı):
 * HAREKET BİLGİ TAŞIR. "Bugün hâlâ yükseltilebilir" gibi neredeyse her zaman doğru bir
 * koşul seçilseydi ışık sürekli yanardı; sürekli yanan ışık bilgi değil gürültüdür.
 *
 * Bu koşul NADİR ve ÖDÜL: parıltı "şu an haftanın en iyi günündesin" der. Kazanılan
 * bir işaret olduğu için tekrar görülmek istenir.
 *
 * Bileşenin içinde satır arası yazılabilirdi; ayrı ve saf durmasının sebebi eşitlik ve
 * sıfır gibi kenar durumların sessizce yanlış çalışabilmesi — grafiğe bakarak fark
 * edilmezler, teste bakarak edilir.
 *
 * @param scores Ekranda görünen 7 günün skorları, eskiden yeniye. Veri olmayan gün < 0.
 */
export function isBestDayOfWeek(scores: number[]): boolean {
  if (scores.length < 2) return false;

  const today = scores[scores.length - 1];
  const rest = scores.slice(0, -1);

  // Sıfır skor "en iyi gün" olamaz: hiçbir şey yapılmamış bir günü kutlamak, işareti
  // anlamsızlaştırır. Veri yokluğu (< 0) da aynı kapıya takılır.
  if (today <= 0) return false;

  // En az üç günlük gerçek veri: iki günlük geçmişte "haftanın en iyisi" boş bir övgü.
  const withData = scores.filter((s) => s >= 0).length;
  if (withData < 3) return false;

  // Eşitlik de kazanır: kendi rekorunu tekrarlamak da iyi bir gündür ve rekorun
  // olduğu gün ışığın sönmesi cezalandırma gibi okunur.
  return rest.every((s) => today >= s);
}

/** Kalkan açıkken skor: son gerçek skor (bugün hariç). Yoksa null; yukarı yuvarlanmaz, dondurmak yükseltmek değildir. */
export function frozenScore(history: { date: string; score: number }[], today: string): number | null {
  const past = history.filter(h => h.score >= 0 && h.date < today).sort((a, b) => a.date.localeCompare(b.date));
  return past.length ? past[past.length - 1].score : null;
}

export interface MomentumHint { kind: 'task' | 'focus'; gain: number }

/** Skoru en çok ne yükseltir: gerçekten hesaplanır, tahmin değil. 1 puandan azsa söylenmez. */
export function momentumHint(input: MomentumInput): MomentumHint | null {
  const base = computeMomentum(input).momentum;
  const now = input.now ?? new Date();
  const today = logicalNow(now);
  today.setHours(23, 59, 59, 999);
  const open = input.tasks
    .filter(t => !t.isCompleted && t.dueDate && parseLocalDate(t.dueDate) <= today)
    .sort((a, b) => (PRIORITY_WEIGHTS[b.priority ?? 'Low'] || 1) - (PRIORITY_WEIGHTS[a.priority ?? 'Low'] || 1));
  let taskGain = 0;
  if (open[0]) {
    const tasks = input.tasks.map(t => (t === open[0] ? { ...t, isCompleted: true, completedAt: now.toISOString() } : t));
    taskGain = computeMomentum({ ...input, tasks }).momentum - base;
  }
  const weeklyFocus = input.weeklyFocus.map((d, i, all) => (i === all.length - 1 ? { minutes: (d.minutes || 0) + 25 } : d));
  const focusGain = computeMomentum({ ...input, weeklyFocus, weeklyMinutes: input.weeklyMinutes + 25 }).momentum - base;
  if (taskGain < 1 && focusGain < 1) return null;
  return taskGain >= focusGain ? { kind: 'task', gain: taskGain } : { kind: 'focus', gain: focusGain };
}

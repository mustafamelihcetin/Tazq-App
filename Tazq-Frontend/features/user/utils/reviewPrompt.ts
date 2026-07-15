/**
 * "Kullanıcıdan uygulama değerlendirmesi istenmeli mi?" kararı.
 *
 * Bu kurallar daha önce app/index.tsx içindeki 2400 satırlık bileşene gömülüydü;
 * saf bir fonksiyona alındı çünkü buradaki her eşik (15 görev, 60 gün, momentum 70)
 * ürün kararı taşıyor ve yanlış tetiklenmesi kullanıcıyı kötü bir anda rahatsız edip
 * düşük puanla sonuçlanıyor. Saf hâlde test edilebilir ve gözden geçirilebilir.
 *
 * Felsefe: yalnızca "iyi an"da sor. Kullanıcı stresliyken (gecikmiş görev, düşük
 * momentum, kötü gün puanı) asla sorma.
 */

export const REVIEW_MIN_COMPLETED_TASKS = 15;
export const REVIEW_COOLDOWN_DAYS = 60;
export const REVIEW_MIN_MOMENTUM = 70;
export const REVIEW_HIGH_MOMENTUM = 90;
export const REVIEW_STREAK_MILESTONE_EVERY = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewPromptInput = {
  completedCount: number;
  /** Oturum başındaki değerler; null = henüz ölçülmedi (cold start). */
  initialCompletedCount: number | null;
  initialStreak: number | null;
  initialMomentum: number | null;
  initialTodayCompleted: number | null;

  overdueCount: number;
  momentum: number;
  todayRating: number | null;
  streak: number;
  todayCompleted: number;
  dailyGoal: number;

  /** Son sorulma zamanı (epoch ms); null = hiç sorulmadı. */
  lastPromptAt: number | null;
  now: number;
};

/**
 * Neden sorulmadığını da döndürür — hem test hem hata ayıklama için.
 * `null` sebep = sorulmalı.
 */
export type ReviewPromptDecision =
  | { shouldPrompt: true; reason: 'dailyGoalMet' | 'streakMilestone' | 'highMomentum' }
  | { shouldPrompt: false; reason: 'tooFewTasks' | 'noProgressThisSession' | 'hasOverdue' | 'lowMomentum' | 'badDay' | 'cooldown' | 'noDelightMoment' };

export function evaluateReviewPrompt(input: ReviewPromptInput): ReviewPromptDecision {
  // 1. Minimum kullanım sınırı — uygulamayı tanımayan kullanıcı puan veremez.
  if (input.completedCount < REVIEW_MIN_COMPLETED_TASKS) {
    return { shouldPrompt: false, reason: 'tooFewTasks' };
  }

  // 2. Oturum kontrolü — bu oturumda bir şey başarmış olmalı.
  if (input.initialCompletedCount !== null && input.completedCount <= input.initialCompletedCount) {
    return { shouldPrompt: false, reason: 'noProgressThisSession' };
  }

  // 3. Stres kontrolleri — kötü anda sorma.
  if (input.overdueCount > 0) return { shouldPrompt: false, reason: 'hasOverdue' };
  if (input.momentum < REVIEW_MIN_MOMENTUM) return { shouldPrompt: false, reason: 'lowMomentum' };
  if (input.todayRating === 1 || input.todayRating === 2) return { shouldPrompt: false, reason: 'badDay' };

  // 4. Cooldown — mağaza kuralı: aynı kullanıcıya sık sorma.
  if (input.lastPromptAt !== null && (input.now - input.lastPromptAt) <= REVIEW_COOLDOWN_DAYS * DAY_MS) {
    return { shouldPrompt: false, reason: 'cooldown' };
  }

  // 5. Başarı anı — biri bu oturumda YENİ gerçekleşmiş olmalı (cold start'ta tetiklenmez).
  const dailyGoalMet =
    input.dailyGoal > 0 &&
    input.todayCompleted >= input.dailyGoal &&
    input.initialTodayCompleted !== null &&
    input.initialTodayCompleted < input.dailyGoal;

  const streakMilestone =
    input.streak > 0 &&
    input.streak % REVIEW_STREAK_MILESTONE_EVERY === 0 &&
    input.initialStreak !== null &&
    input.streak !== input.initialStreak;

  const highMomentum =
    input.momentum >= REVIEW_HIGH_MOMENTUM &&
    input.initialMomentum !== null &&
    input.initialMomentum < REVIEW_HIGH_MOMENTUM;

  if (dailyGoalMet) return { shouldPrompt: true, reason: 'dailyGoalMet' };
  if (streakMilestone) return { shouldPrompt: true, reason: 'streakMilestone' };
  if (highMomentum) return { shouldPrompt: true, reason: 'highMomentum' };

  return { shouldPrompt: false, reason: 'noDelightMoment' };
}

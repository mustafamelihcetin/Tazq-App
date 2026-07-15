import {
  evaluateReviewPrompt,
  ReviewPromptInput,
  REVIEW_COOLDOWN_DAYS,
} from '@/features/user/utils/reviewPrompt';

const NOW = new Date('2026-07-15T12:00:00Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

// "İyi an": tüm kapılar açık, günlük hedef bu oturumda yeni tamamlandı.
function goodMoment(overrides: Partial<ReviewPromptInput> = {}): ReviewPromptInput {
  return {
    completedCount: 20,
    initialCompletedCount: 19, // bu oturumda 1 görev tamamlandı
    initialStreak: 5,
    initialMomentum: 80,
    initialTodayCompleted: 2, // hedefin altındaydı
    overdueCount: 0,
    momentum: 85,
    todayRating: null,
    streak: 5,
    todayCompleted: 5,
    dailyGoal: 5, // hedefe bu oturumda ulaşıldı
    lastPromptAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('evaluateReviewPrompt', () => {
  it('prompts when the daily goal is newly met', () => {
    const d = evaluateReviewPrompt(goodMoment());
    expect(d).toEqual({ shouldPrompt: true, reason: 'dailyGoalMet' });
  });

  it('prompts on a new streak milestone', () => {
    const d = evaluateReviewPrompt(goodMoment({
      streak: 6, // 3'ün katı
      initialStreak: 5, // bu oturumda değişti
      todayCompleted: 2,
      dailyGoal: 5, // hedef tutmadı → milestone yolu denensin
      initialTodayCompleted: 2,
    }));
    expect(d).toEqual({ shouldPrompt: true, reason: 'streakMilestone' });
  });

  it('prompts when momentum newly crosses the high threshold', () => {
    const d = evaluateReviewPrompt(goodMoment({
      momentum: 95,
      initialMomentum: 80, // eşiği bu oturumda geçti
      todayCompleted: 2,
      initialTodayCompleted: 2,
      streak: 5,
      initialStreak: 5,
    }));
    expect(d).toEqual({ shouldPrompt: true, reason: 'highMomentum' });
  });

  // ─── Stres kapıları: kullanıcı kötü andayken asla sorma ───────────────────

  it('never prompts while tasks are overdue', () => {
    const d = evaluateReviewPrompt(goodMoment({ overdueCount: 1 }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('hasOverdue');
  });

  it('never prompts when momentum is low', () => {
    const d = evaluateReviewPrompt(goodMoment({ momentum: 69 }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('lowMomentum');
  });

  it.each([1, 2])('never prompts when the user rated today %i', (rating) => {
    const d = evaluateReviewPrompt(goodMoment({ todayRating: rating }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('badDay');
  });

  // ─── Kullanım ve cooldown ────────────────────────────────────────────────

  it('does not prompt a user who has not used the app enough', () => {
    const d = evaluateReviewPrompt(goodMoment({ completedCount: 14, initialCompletedCount: 13 }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('tooFewTasks');
  });

  it('does not prompt without progress in this session', () => {
    const d = evaluateReviewPrompt(goodMoment({ completedCount: 20, initialCompletedCount: 20 }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('noProgressThisSession');
  });

  it('respects the 60-day cooldown', () => {
    const d = evaluateReviewPrompt(goodMoment({ lastPromptAt: NOW - 59 * DAY_MS }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('cooldown');
  });

  it('prompts again once the cooldown has fully elapsed', () => {
    const d = evaluateReviewPrompt(goodMoment({ lastPromptAt: NOW - (REVIEW_COOLDOWN_DAYS + 1) * DAY_MS }));
    expect(d.shouldPrompt).toBe(true);
  });

  // ─── Cold start: oturum başlangıcı ölçülmeden tetiklenmemeli ──────────────

  it('does not prompt on cold start when session baselines are unknown', () => {
    const d = evaluateReviewPrompt(goodMoment({
      initialTodayCompleted: null,
      initialStreak: null,
      initialMomentum: null,
    }));
    // Baseline yoksa "bu oturumda yeni ulaşıldı" iddia edilemez.
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('noDelightMoment');
  });

  it('does not prompt when a milestone was already true at session start', () => {
    const d = evaluateReviewPrompt(goodMoment({
      todayCompleted: 5,
      dailyGoal: 5,
      initialTodayCompleted: 5, // oturum başında zaten hedefteydi
      streak: 5,
      initialStreak: 5,
      momentum: 95,
      initialMomentum: 95, // zaten yüksekti
    }));
    expect(d.shouldPrompt).toBe(false);
    expect(d.reason).toBe('noDelightMoment');
  });

  it('does not treat a zero daily goal as met', () => {
    const d = evaluateReviewPrompt(goodMoment({
      dailyGoal: 0,
      todayCompleted: 0,
      initialTodayCompleted: null,
      streak: 5,
      initialStreak: 5,
      momentum: 85,
      initialMomentum: 85,
    }));
    expect(d.shouldPrompt).toBe(false);
  });
});

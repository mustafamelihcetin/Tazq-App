import { computeWeeklyMetrics, generateWeeklyTips, getCoachAction, WeeklyInsightInput, getSmartInsight } from '@/shared/utils/insights';

describe('getSmartInsight (Akıllı İçgörü Motoru)', () => {
  const dummyTask = { title: 'Ders çalış', priority: 'Medium', isCompleted: false };

  it('returns focus active message when focus is active', () => {
    const res = getSmartInsight('tr', true, 50, undefined, undefined, []);
    expect(res).toContain('Odak modu aktif');
  });

  it('congratulates when daily target is met', () => {
    const res = getSmartInsight('tr', false, 80, dummyTask, dummyTask, [], undefined, 3, 3);
    expect(res).toContain('başarıyla ulaştın');
    expect(res).toContain('3/3');
  });

  it('returns custom message for exam mode', () => {
    const examTask = { title: 'Matematik sorusu çöz', priority: 'High', isCompleted: false };
    const seasonal = { examMode: true, examName: 'YKS', examDate: '2026-06-15' };
    const res = getSmartInsight('tr', false, 50, examTask, examTask, [], seasonal);
    expect(res).toContain('YKS hazırlığında bugün kritik bir gün');
    expect(res).toContain('Matematik sorusu çöz');
  });

  it('categorizes academic task and offers custom advice', () => {
    const academicTask = { title: 'Fizik konu tekrarı yap', priority: 'Medium', isCompleted: false };
    const res = getSmartInsight('tr', false, 50, undefined, academicTask, []);
    expect(res).toContain('Zihninin en berrak saatlerini');
    expect(res).toContain('Fizik konu tekrarı yap');
  });

  it('categorizes health/sport task and offers movement advice', () => {
    const healthTask = { title: 'Kardiyo egzersizi yap', priority: 'Medium', isCompleted: false };
    const res = getSmartInsight('tr', false, 50, undefined, healthTask, []);
    expect(res).toContain('bedenini ve zihnini biraz hareketlendirme zamanı');
  });

  it('handles todayRating for excellent and terrible days', () => {
    const resExcellent = getSmartInsight('tr', false, 50, undefined, undefined, [], undefined, 0, 0, 5);
    expect(resExcellent).toContain('Bugün gerçekten harika bir uyum yakalamışsın.');

    const resTough = getSmartInsight('tr', false, 50, undefined, undefined, [], undefined, 0, 0, 1);
    expect(resTough).toContain('Bugün senin için biraz yorucu ve zor geçmiş.');
  });
});

describe('getCoachAction (kural-tabanlı koç)', () => {
  it('prioritizes streak restart when streak is 0', () => {
    const a = getCoachAction({ streak: 0, todayFocusMin: 30, todayTasksDone: 2, momentum: 80 });
    expect(a.route).toBe('/tasks');
    expect(a.tone).toBe('motivational');
  });
  it('suggests focus when no focus today', () => {
    const a = getCoachAction({ streak: 5, todayFocusMin: 0, todayTasksDone: 0, momentum: 50 });
    expect(a.route).toBe('/focus');
  });
  it('suggests first task when focused but no task done', () => {
    const a = getCoachAction({ streak: 5, todayFocusMin: 25, todayTasksDone: 0, momentum: 50 });
    expect(a.route).toBe('/tasks');
  });
  it('nudges when momentum low', () => {
    const a = getCoachAction({ streak: 5, todayFocusMin: 25, todayTasksDone: 3, momentum: 30 });
    expect(a.tone).toBe('motivational');
  });
  it('is positive with no route when doing well', () => {
    const a = getCoachAction({ streak: 5, todayFocusMin: 60, todayTasksDone: 4, momentum: 85 });
    expect(a.tone).toBe('positive');
    expect(a.route).toBeUndefined();
  });
});

const base: WeeklyInsightInput = {
  weeklyFocusMinutes: [0, 30, 0, 60, 90, 0, 25],
  completedTasksWeek: 8,
  streak: 4,
  momentumLast7: [40, 45, 50, 55, 60, 65, 70],
  productivityHour: 'evening',
};

describe('computeWeeklyMetrics', () => {
  it('sums focus and finds best day', () => {
    const m = computeWeeklyMetrics(base);
    expect(m.totalFocusMin).toBe(205);
    expect(m.activeDays).toBe(4);
    expect(m.bestDayIndex).toBe(4); // 90 dk
    expect(m.bestDayMinutes).toBe(90);
  });

  it('detects rising momentum trend', () => {
    expect(computeWeeklyMetrics(base).momentumTrend).toBe('up');
  });

  it('detects falling momentum trend', () => {
    const m = computeWeeklyMetrics({ ...base, momentumLast7: [80, 75, 70, 50, 40, 30, 20] });
    expect(m.momentumTrend).toBe('down');
  });

  it('handles no momentum data', () => {
    const m = computeWeeklyMetrics({ ...base, momentumLast7: [-1, -1, -1, -1, -1, -1, -1] });
    expect(m.avgMomentum).toBe(-1);
    expect(m.momentumTrend).toBe('na');
  });
});

describe('generateWeeklyTips', () => {
  it('prioritizes restart tip when no streak', () => {
    const tips = generateWeeklyTips({ ...base, streak: 0 });
    expect(tips[0].tone).toBe('motivational');
    expect(tips[0].textTr).toMatch(/seri/i);
  });

  it('warns on low focus', () => {
    const tips = generateWeeklyTips({ ...base, weeklyFocusMinutes: [0, 0, 10, 0, 0, 0, 0] });
    expect(tips.some(t => t.tone === 'warning' && /odak/i.test(t.textTr))).toBe(true);
  });

  it('never returns empty and respects max', () => {
    const tips = generateWeeklyTips(base, 2);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.length).toBeLessThanOrEqual(2);
  });

  it('always returns at least a neutral fallback for a balanced week', () => {
    const tips = generateWeeklyTips({ weeklyFocusMinutes: [60, 60, 60, 60, 60, 60, 60], completedTasksWeek: 5, streak: 3, momentumLast7: [60, 60, 60, 60, 60, 60, 60], productivityHour: 'morning' });
    expect(tips.length).toBeGreaterThan(0);
  });

  it('adds a warning when tasks are completed too quickly (Velocity Guard)', () => {
    const time1 = new Date().toISOString();
    const time2 = new Date(Date.now() + 2000).toISOString();
    const time3 = new Date(Date.now() + 4000).toISOString();
    const time4 = new Date(Date.now() + 6000).toISOString();

    const tips = generateWeeklyTips({
      ...base,
      tasks: [
        { id: 1, isCompleted: true, completedAt: time1 },
        { id: 2, isCompleted: true, completedAt: time2 },
        { id: 3, isCompleted: true, completedAt: time3 },
        { id: 4, isCompleted: true, completedAt: time4 },
      ]
    });

    expect(tips.some(t => t.tone === 'warning' && /hız/i.test(t.textTr))).toBe(true);
  });
});

import { computeWeeklyMetrics, generateWeeklyTips, getCoachAction, WeeklyInsightInput } from '../utils/insights';

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
});

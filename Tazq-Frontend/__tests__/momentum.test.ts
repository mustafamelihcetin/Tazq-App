import { computeMomentum, MomentumInput } from '@/shared/utils/momentum';

const NOW = new Date('2026-06-29T12:00:00Z');
const todayIso = NOW.toISOString();

const base: MomentumInput = {
  tasks: [],
  weeklyFocus: [],
  weeklyMinutes: 0,
  streak: 0,
  habitActivityDays: 0,
  now: NOW,
};

describe('computeMomentum', () => {
  it('returns 0 for an empty week', () => {
    expect(computeMomentum(base).momentum).toBe(0);
  });

  it('counts only tasks within the last 7 days', () => {
    const old = new Date('2026-06-01T12:00:00Z').toISOString();
    const r = computeMomentum({
      ...base,
      tasks: [
        { priority: 'High', isCompleted: true, dueDate: todayIso },
        { priority: 'High', isCompleted: true, dueDate: old },
      ],
    });
    expect(r.totalCount).toBe(1);
    expect(r.completedCount).toBe(1);
  });

  it('weights high-priority completions fully when done today', () => {
    const r = computeMomentum({
      ...base,
      tasks: [{ priority: 'High', isCompleted: true, dueDate: todayIso }],
    });
    expect(r.weightedCompletion).toBe(1);
    // 38% completion weight → 38 points
    expect(r.momentum).toBe(38);
  });

  it('caps the score at 100', () => {
    const fullFocus = Array.from({ length: 7 }, () => ({ minutes: 120 }));
    const r = computeMomentum({
      ...base,
      tasks: [{ priority: 'High', isCompleted: true, dueDate: todayIso }],
      weeklyFocus: fullFocus,
      weeklyMinutes: 840,
      streak: 60,
      habitActivityDays: 7,
    });
    expect(r.momentum).toBe(100);
  });

  it('applies diminishing returns on long streaks', () => {
    const short = computeMomentum({ ...base, streak: 14 }).streakScore;
    const long = computeMomentum({ ...base, streak: 42 }).streakScore;
    expect(short).toBe(1);
    expect(long).toBeGreaterThan(1);
    expect(long).toBeLessThanOrEqual(1.15);
  });

  it('penalizes tasks completed in rapid succession (Velocity Guard)', () => {
    const time1 = new Date('2026-06-29T12:00:00Z').toISOString();
    const time2 = new Date('2026-06-29T12:00:05Z').toISOString();
    const time3 = new Date('2026-06-29T12:00:30Z').toISOString();

    const r = computeMomentum({
      ...base,
      tasks: [
        { id: 1, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time1 },
        { id: 2, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time2 },
        { id: 3, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time3 },
      ],
    });

    expect(r.weightedCompletion).toBeCloseTo(0.67, 2);
  });
});

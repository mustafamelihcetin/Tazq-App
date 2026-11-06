import { computeMomentum, frozenScore, momentumHint, MomentumInput } from '@/shared/utils/momentum';
import { momentumOnDay, rollingDays } from '@/features/user/utils/momentumInput';

const NOW = new Date('2026-06-29T12:00:00Z');
const todayIso = NOW.toISOString();

const base: MomentumInput = {
  tasks: [],
  weeklyFocus: [],
  weeklyMinutes: 0,
  streak: 0,
  habitRatio: 0,
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
      habitRatio: 1,
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

  /*
    2026-10-25: "Velocity Guard" (10 sn içinde tamamlanan görevi saymamak) KALDIRILDI.
    Uygulamanın kendi TOPLU SEÇİM özelliğiyle birden çok görevi bitiren kullanıcıyı
    cezalandırıyordu. Skor bir ORANDIR (kazanılan / toplam ağırlık) — hızla şişirilemez.
  */
  it('art arda (toplu) tamamlanan görevler TAM sayılır — hız cezası yok', () => {
    const time1 = new Date('2026-06-29T12:00:00Z').toISOString();
    const time2 = new Date('2026-06-29T12:00:01Z').toISOString();
    const time3 = new Date('2026-06-29T12:00:02Z').toISOString();

    const r = computeMomentum({
      ...base,
      tasks: [
        { id: 1, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time1 },
        { id: 2, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time2 },
        { id: 3, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: time3 },
      ],
    });

    expect(r.weightedCompletion).toBeCloseTo(1, 5);
  });

  it('eski sürümde cezalı işaretlenmiş görev de artık sayılır', () => {
    const r = computeMomentum({
      ...base,
      tasks: [{ id: 1, priority: 'High', isCompleted: true, dueDate: todayIso, completedAt: todayIso, ignoreMomentum: true }],
    });
    expect(r.weightedCompletion).toBeCloseTo(1, 5);
  });
});

describe('Momentum gerçek işi ölçer (2026-11-06)', () => {
  const NOW2 = new Date(2026, 10, 6, 12);
  const at = (d: number) => new Date(2026, 10, 6 + d, 12).toISOString();
  const base2 = { tasks: [], weeklyFocus: [], weeklyMinutes: 0, streak: 0, habitRatio: 0, now: NOW2 } as MomentumInput;
  const done = [0, 1, 2].map(i => ({ id: i, priority: 'Medium', isCompleted: true, dueDate: at(-i) }));

  it('ileri tarihli görev skoru düşürmez', () => {
    const future = [20, 21, 22].map(i => ({ id: 100 + i, priority: 'High', isCompleted: false, dueDate: at(i) }));
    expect(computeMomentum({ ...base2, tasks: [...done, ...future] }).momentum).toBe(computeMomentum({ ...base2, tasks: done }).momentum);
  });
  it('tarihsiz görev bitince sayılır', () => {
    const r = computeMomentum({ ...base2, tasks: [{ id: 1, priority: 'Low', isCompleted: true, dueDate: null, completedAt: at(0) }] });
    expect(r.momentum).toBe(38);
  });
  it('bitirildiği gün geçerli: eski vadeli görev bugün bitince tam sayılır', () => {
    const r = computeMomentum({ ...base2, tasks: [{ id: 1, priority: 'High', isCompleted: true, dueDate: at(-30), completedAt: at(0) }] });
    expect(r.weightedCompletion).toBe(1);
  });
  it('bugün gelmemiş tamamlanma, o gün için bitmemiştir (geçmiş skor)', () => {
    const r = computeMomentum({ ...base2, now: new Date(2026, 10, 3, 12), tasks: [{ id: 1, priority: 'High', isCompleted: true, dueDate: at(-3), completedAt: at(0) }] });
    expect(r.weightedCompletion).toBe(0);
  });
  it('gecikmiş ve bugünkü bitmemiş iş düşürür', () => {
    const r = computeMomentum({ ...base2, tasks: [...done, { id: 9, priority: 'High', isCompleted: false, dueDate: at(0) }] });
    expect(r.weightedCompletion).toBeLessThan(1);
  });
  it('alışkanlık oranı puan verir; alışkanlığı olmayan ceza görmez', () => {
    expect(computeMomentum({ ...base2, habitRatio: 1 }).momentum).toBe(10);
    expect(computeMomentum({ ...base2, tasks: done, habitRatio: null }).momentum).toBe(42);
  });
  it('kalkan dondurur: son gerçek skor, yukarı çekmez', () => {
    expect(frozenScore([{ date: '2026-11-04', score: 20 }, { date: '2026-11-05', score: 31 }, { date: '2026-11-06', score: 90 }], '2026-11-06')).toBe(31);
    expect(frozenScore([], '2026-11-06')).toBeNull();
  });
  it('ipucu hesaplanır ve 1 puandan azsa susar', () => {
    const open = { id: 9, priority: 'High', isCompleted: false, dueDate: at(0) };
    const h = momentumHint({ ...base2, tasks: [open], weeklyFocus: Array.from({ length: 7 }, () => ({ minutes: 0 })) });
    expect(h?.kind).toBe('task');
    expect(h?.gain).toBeGreaterThanOrEqual(1);
    expect(momentumHint({ ...base2, weeklyFocus: Array.from({ length: 7 }, () => ({ minutes: 120 })), weeklyMinutes: 840 })).toBeNull();
  });
});

describe('geçmiş günün skoru', () => {
  it('o güne kadarki kayıtlarla hesaplanır', () => {
    const tasks = [{ id: 1, priority: 'High', isCompleted: true, dueDate: null, completedAt: new Date(2026, 10, 5, 10).toISOString() }];
    const p = { tasks: tasks as never, sessions: [], habits: [], focusGoalMinutes: 25 };
    expect(momentumOnDay('2026-11-04', p)).toBe(0);
    expect(momentumOnDay('2026-11-05', p)).toBeGreaterThan(0);
  });
  it('7 günlük pencere pazartesi sıfırlanmaz', () => {
    expect(rollingDays(new Date(2026, 10, 2, 12))).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('ana sayfa ve baloncuk', () => {
  it('baloncuk ana sayfayı yeniden çizmez: Android açılışta içerik kayboluyordu', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../features/dashboard/hooks/useHomeModel.tsx'), 'utf8');
    expect(src).toContain('useToastStore(s => s.show)');
    expect(src).not.toContain('useToastStore();');
  });
});

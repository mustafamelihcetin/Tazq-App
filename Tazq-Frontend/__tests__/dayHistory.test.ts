/**
 * Ana sayfa "haftayı kaydır": bugünden geriye 7 gün, haftalık geri bakışla aynı sayım kuralları.
 */
import { lastDays } from '@/features/dashboard/utils/dayHistory';

const now = new Date(2026, 9, 30, 12);
const iso = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();

describe('son 7 gün', () => {
  it('bugünden geriye 7 gün, eskiden yeniye', () => {
    const r = lastDays({ sessions: [], tasks: [], habits: [] }, now);
    expect(r.map(d => d.key)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  });

  it('odak dakikası yerel güne, erken bitenler dahil', () => {
    const r = lastDays({ sessions: [{ startedAt: iso(28), minutes: 9 }, { startedAt: iso(28, 15), minutes: 3 }], tasks: [], habits: [] }, now);
    expect(r[4].focusMin).toBe(12);
  });

  it('görev bittiği güne sayılır; vadesi o gün olup bitmeyen paydaya girer', () => {
    const tasks = [
      { isCompleted: true, completedAt: iso(29), dueDate: '2026-10-29' },
      { isCompleted: false, dueDate: '2026-10-29' },
      { isCompleted: true, completedAt: iso(30), dueDate: '2026-10-29' }, // geç bitti: 29'un paydası, 30'un tamamı
    ];
    const r = lastDays({ sessions: [], tasks, habits: [] }, now);
    expect(r[5]).toMatchObject({ tasksDone: 1, tasksTotal: 3 });
    expect(r[6]).toMatchObject({ tasksDone: 1, tasksTotal: 1 });
  });

  it('alışkanlık kurulmadan önceki günlerde beklenmez', () => {
    const habits = [{ id: 'a', createdAt: iso(28), completedDates: ['2026-10-28', '2026-10-30'] }];
    const r = lastDays({ sessions: [], tasks: [], habits }, now);
    expect(r.slice(0, 4).every(d => d.habitsTotal === 0)).toBe(true);
    expect(r.slice(4).map(d => `${d.habitsDone}/${d.habitsTotal}`)).toEqual(['1/1', '0/1', '1/1']);
  });
});

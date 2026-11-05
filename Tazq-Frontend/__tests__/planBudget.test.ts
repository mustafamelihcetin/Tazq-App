import { allocatePlanBudget, planBudgetFor, buildDailyTasks } from '@/features/modes/utils/dailyPlanEngine';

/*
  GÜNLÜK PLAN BÜTÇESİ + YÖNTEM (2026-11-01): modlar toplamda yığılmaz; seçilen yöntem gerçekten görevi değiştirir.
*/
describe('plan bütçesi', () => {
  it('kendi işin çoksa daralır', () => {
    expect(planBudgetFor(0)).toBe(4);
    expect(planBudgetFor(3)).toBe(3);
    expect(planBudgetFor(6)).toBe(2);
  });

  it('önce her moda 1 (en yakın tarih önce), sonra kalan istek sırasına göre; toplam bütçeyi aşmaz', () => {
    // 4 mod, her biri 3 istiyor, bütçe 4 → her birine 1
    expect(allocatePlanBudget([{ daysLeft: 90 }, { daysLeft: 10 }, { daysLeft: 40 }, { daysLeft: 200 }], [3, 3, 3, 3], 4)).toEqual([1, 1, 1, 1]);
    // 2 mod, bütçe 4 → en yakın tarihli fazlasını alır
    expect(allocatePlanBudget([{ daysLeft: 60 }, { daysLeft: 5 }], [3, 3], 4)).toEqual([1, 3]);
    // bütçe mod sayısından az → en uzak tarihli o gün almaz
    expect(allocatePlanBudget([{ daysLeft: 60 }, { daysLeft: 5 }, { daysLeft: 30 }], [2, 2, 2], 2)).toEqual([0, 1, 1]);
  });

  it('bütçe sıfırsa o mod bugün görev üretmez', () => {
    expect(buildDailyTasks({ kind: 'exam', daysLeft: 50, dailyMinutes: 180, maxCount: 0 }, [], 'tr', new Date(2026, 10, 10))).toEqual([]);
  });
});

describe('çalışma yöntemi', () => {
  it('seçilen yöntem günün ilk görevini belirler', () => {
    const t = buildDailyTasks({ kind: 'exam', name: 'KPSS', daysLeft: 50, dailyMinutes: 180, templateId: 'active-recall' }, [], 'tr', new Date(2026, 10, 10));
    expect(t.length).toBe(3);
    expect(t[0].title).toMatch(/KPSS: (Kitabı kapat|10 soruyu|Konuyu kendi|Kavram haritasını)/);
  });

  it('yöntem seçilmemişse eskisi gibi', () => {
    const t = buildDailyTasks({ kind: 'exam', name: 'KPSS', daysLeft: 50, dailyMinutes: 180 }, [], 'tr', new Date(2026, 10, 10));
    expect(t[0].title).not.toMatch(/Kitabı kapat/);
  });
});

describe('son kapı: bugünkü plan bütçesi (2026-11-05)', () => {
  const { trimToPlanBudget } = require('@/features/modes/utils/dailyPlanEngine');
  const today = new Date(2026, 10, 5, 10);
  const iso = today.toISOString();
  const open = (id: number) => ({ id, dueDate: iso, isCompleted: false });
  it('bütçe doluysa bugüne yeni görev eklenmez', () => {
    const tasks = [1, 2, 3, 4].map(open);
    expect(trimToPlanBudget([{ dueDate: iso }], tasks, new Set([1, 2, 3, 4]), today)).toEqual([]);
  });
  it('kalan kadar geçer; başka gün ve tartım etkilenmez', () => {
    const later = { dueDate: new Date(2026, 10, 6).toISOString() };
    const weigh = { dueDate: iso, tags: ['weight_entry'] };
    const out = trimToPlanBudget([{ dueDate: iso }, { dueDate: iso }, later, weigh], [1, 2, 3].map(open), new Set([1, 2, 3]), today);
    expect(out).toHaveLength(3);
    expect(out).toContain(later);
    expect(out).toContain(weigh);
  });
  it('kendi işleri çoksa bütçe daralır', () => {
    const tasks = [1, 2, 3, 4, 5, 6].map(open);
    expect(trimToPlanBudget([{ dueDate: iso }, { dueDate: iso }], tasks, new Set([6]), today)).toHaveLength(1);
  });
});

describe('aynı plan işi çoğalmaz (2026-11-05)', () => {
  const { isSamePlanOccurrence } = require('@/features/modes/utils/dailyPlanEngine');
  const d = (day: number) => new Date(2026, 10, day, 9).toISOString();
  it('bitmemiş eski kopya varsa yenisi açılmaz', () => expect(isSamePlanOccurrence({ dueDate: d(1) }, { dueDate: d(5) })).toBe(true));
  it('bitmiş eski kopya engellemez', () => expect(isSamePlanOccurrence({ dueDate: d(1), isCompleted: true }, { dueDate: d(5) })).toBe(false));
  it('aynı gün kopyası bitmiş olsa da engeller', () => expect(isSamePlanOccurrence({ dueDate: d(5), isCompleted: true }, { dueDate: d(5) })).toBe(true));
  it('ileri tarihli kopya bugünü engellemez', () => expect(isSamePlanOccurrence({ dueDate: d(9) }, { dueDate: d(5) })).toBe(false));
});

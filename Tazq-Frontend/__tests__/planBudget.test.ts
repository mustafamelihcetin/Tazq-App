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

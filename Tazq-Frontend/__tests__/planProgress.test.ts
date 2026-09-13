import { planProgressFor, type PlanTaskLike } from '@/features/modes/utils/planProgress';

/**
 * ÖLÇÜLEN HATA: ana ekran "bugün plan görevin yok" diyordu, Görevler ekranında o
 * görevler duruyordu.
 *
 * Sebep: bugünün plan görevleri `t.tags.includes('daily')` şartıyla sayılıyordu. O
 * etiket YALNIZCA günlük plan motorunun ürettiği görevlerde var; mod kurulurken oluşan
 * görevler (ör. "3 aylık milestone planı yap") modun kendi adıyla etiketleniyor ve
 * yüksek öncelikliler BUGÜNE kuruluyor (bkz. TurkishModeBanner → getTaskDueDate).
 *
 * İki ekran aynı soruya farklı cevap verince kullanıcı hangisine güveneceğini bilemez.
 * Doğru soru "bu görevi hangi motor üretti" değil, "bugüne kurulmuş mu".
 */
describe('plan ilerleyişi — bugünün görevleri', () => {
  const NOW = new Date('2026-09-13T10:00:00');
  const iso = (d: string) => new Date(`${d}T09:00:00`).toISOString();

  const tasks: PlanTaskLike[] = [
    // Mod kurulumundan gelen görev: `daily` YOK, bugüne kurulmuş.
    { id: 1, dueDate: iso('2026-09-13'), tags: ['tez', 'milestone'], isCompleted: false },
    // Günlük motorun ürettiği görev: `daily` VAR, bugüne kurulmuş, bitmiş.
    { id: 2, dueDate: iso('2026-09-13'), tags: ['tez', 'daily'], isCompleted: true },
    // İleri tarihli plan görevi — bugünün işi değil ama AÇIK.
    { id: 3, dueDate: iso('2026-09-15'), tags: ['tez'], isCompleted: false },
    // Plana ait olmayan görev — hiç sayılmamalı.
    { id: 99, dueDate: iso('2026-09-13'), tags: ['iş'], isCompleted: false },
  ];
  const planIds = [1, 2, 3];

  it('etiketten BAĞIMSIZ: bugüne kurulmuş her plan görevi sayılır', () => {
    const p = planProgressFor(tasks, planIds, NOW);
    expect(p.todayTotal).toBe(2); // 1 (daily yok) + 2 (daily var)
    expect(p.todayDone).toBe(1);
  });

  it('plana ait olmayan görev sayılmaz', () => {
    const p = planProgressFor(tasks, planIds, NOW);
    expect(p.taskTotal).toBe(3);
  });

  it('ileri tarihli görev bugüne girmez ama AÇIK sayılır', () => {
    const p = planProgressFor(tasks, planIds, NOW);
    expect(p.openTotal).toBe(2); // id 1 ve 3
  });

  it('tarihsiz görev "bugün" sayılmaz', () => {
    const p = planProgressFor([{ id: 1, tags: ['tez'], isCompleted: false }], [1], NOW);
    expect(p.todayTotal).toBe(0);
    expect(p.openTotal).toBe(1);
  });

  it('SİLİNMİŞ görev sayılmaz — kayıtlı id listesi tek başına yeterli değil', () => {
    // taskTotal eskiden id listesinin uzunluğuydu: kullanıcı görevi silse bile
    // plan "4 görev" diyordu.
    const p = planProgressFor([{ id: 1, dueDate: iso('2026-09-13'), isCompleted: false }], [1, 2, 3], NOW);
    expect(p.taskTotal).toBe(1);
  });

  it('geçersiz tarih çökertmez', () => {
    const p = planProgressFor([{ id: 1, dueDate: 'bozuk-tarih', isCompleted: false }], [1], NOW);
    expect(p.todayTotal).toBe(0);
  });

  it('boş plan sıfır döner', () => {
    const p = planProgressFor(tasks, [], NOW);
    expect(p).toEqual({ todayTotal: 0, todayDone: 0, openTotal: 0, taskTotal: 0 });
  });
});

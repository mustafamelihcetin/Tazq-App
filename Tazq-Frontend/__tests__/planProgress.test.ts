import { planProgressFor, modeToday, type PlanTaskLike } from '@/features/modes/utils/planProgress';

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

  // "Bugün" sayımı modeToday'de (tek tanım); planProgressFor yalnız açık/toplam görev söyler.
  const today = (ts: PlanTaskLike[], ids: number[]) => modeToday({ tasks: ts, habits: [], planTaskIds: ids, planHabitIds: [], now: NOW });

  it('etiketten BAĞIMSIZ: bugüne kurulmuş her plan görevi sayılır', () => {
    expect(today(tasks, planIds)).toEqual({ total: 2, done: 1 }); // 1 (daily yok) + 2 (daily var)
  });

  it('plana ait olmayan görev sayılmaz', () => {
    const p = planProgressFor(tasks, planIds);
    expect(p.taskTotal).toBe(3);
  });

  it('ileri tarihli görev bugüne girmez ama AÇIK sayılır', () => {
    const p = planProgressFor(tasks, planIds);
    expect(p.openTotal).toBe(2); // id 1 ve 3
  });

  it('tarihsiz görev "bugün" sayılmaz', () => {
    expect(today([{ id: 1, tags: ['tez'], isCompleted: false }], [1]).total).toBe(0);
    expect(planProgressFor([{ id: 1, tags: ['tez'], isCompleted: false }], [1]).openTotal).toBe(1);
  });

  it('SİLİNMİŞ görev sayılmaz — kayıtlı id listesi tek başına yeterli değil', () => {
    // taskTotal eskiden id listesinin uzunluğuydu: kullanıcı görevi silse bile
    // plan "4 görev" diyordu.
    const p = planProgressFor([{ id: 1, dueDate: iso('2026-09-13'), isCompleted: false }], [1, 2, 3]);
    expect(p.taskTotal).toBe(1);
  });

  it('geçersiz tarih çökertmez', () => {
    expect(today([{ id: 1, dueDate: 'bozuk-tarih', isCompleted: false }], [1]).total).toBe(0);
  });

  it('boş plan sıfır döner', () => {
    expect(planProgressFor(tasks, [])).toEqual({ openTotal: 0, taskTotal: 0 });
  });
});

/**
 * MODUN BUGÜNÜ — TEK SAYI (2026-10-31, yeniden düzenleme Y-1).
 *
 * Cihazda görüldü: ana sayfa aynı mod için "0/2 plan görevi", Hedefler "0/3" diyordu.
 * "Bugün" dört yerde ayrı sayılıyordu: özet kancası yalnız GÖREV, Hedefler/mod kartları/yol
 * haritası rozeti görev + modun BÜTÜN alışkanlıkları (dinlenen ve o gün planlı olmayan dahil).
 * Tanım artık tek: bugün vadeli ya da bugün bitirilen plan görevleri + BUGÜN PLANLI plan
 * alışkanlıkları (habitSchedule.isDueToday: dinlenen yok, gün planına uyar).
 */
describe('modeToday — modun bugünü tek tanım', () => {
  const fs = require('fs');
  const path = require('path');
  const NOW = new Date('2026-10-31T10:00:00'); // Cumartesi
  const at = (d: string) => new Date(`${d}T09:00:00`).toISOString();

  const tasks = [
    { id: 1, dueDate: at('2026-10-31'), isCompleted: false },
    { id: 2, dueDate: at('2026-10-31'), isCompleted: true, completedAt: at('2026-10-31') },
    { id: 3, dueDate: at('2026-11-02'), isCompleted: true, completedAt: at('2026-10-31') }, // erken bitirildi → bugünün işi
    { id: 4, dueDate: at('2026-11-02'), isCompleted: false }, // yarından sonra
    { id: 5, dueDate: at('2026-10-31'), isCompleted: false }, // plana ait değil
  ];
  const habits = [
    { id: 'a', completedDates: ['2026-10-31'] },                                  // her gün, bugün yapıldı
    { id: 'b', completedDates: [] },                                              // her gün, bekliyor
    { id: 'c', completedDates: [], schedule: { kind: 'days' as const, days: [0, 2] } }, // Pzt/Çar — bugün planlı DEĞİL
    { id: 'd', completedDates: [], pausedAt: '2026-10-20' },                      // dinleniyor
  ];

  it('görev + bugün planlı alışkanlık; plan dışı, dinlenen ve günü olmayan sayılmaz', () => {
    expect(modeToday({ tasks, habits, planTaskIds: [1, 2, 3, 4], planHabitIds: ['a', 'b', 'c', 'd'], now: NOW }))
      .toEqual({ done: 3, total: 5 });
  });

  it('gece kuşu: 01:00 alışkanlık için hâlâ dün, görev için takvim günü (kartlarla aynı ayrım)', () => {
    const NIGHT = new Date('2026-11-01T01:00:00');
    // Alışkanlık 'a' 31 Ekim'de yapıldı → 01:00'de hâlâ bugünün işi (fmtDateKey tamponu).
    // Görev 1 (31 Ekim vadeli) takvimde artık dün → bugünün işi DEĞİL.
    expect(modeToday({ tasks, habits, planTaskIds: [1], planHabitIds: ['a'], now: NIGHT })).toEqual({ done: 1, total: 1 });
  });

  it('saf gün biçimli vade (sunucu) UTC kaymasına düşmez', () => {
    expect(modeToday({ tasks: [{ id: 9, dueDate: '2026-10-31T00:00:00Z', isCompleted: false }], habits: [], planTaskIds: [9], planHabitIds: [], now: NOW }))
      .toEqual({ done: 0, total: 1 });
  });

  it('plan boşsa 0/0', () => {
    expect(modeToday({ tasks, habits, planTaskIds: [], planHabitIds: [], now: NOW })).toEqual({ done: 0, total: 0 });
  });

  it('bugünü sayan her yüzey aynı fonksiyonu kullanır — kopya formül kalmadı', () => {
    const root = path.join(__dirname, '..');
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
    for (const f of ['TezCard', 'ExamCard', 'MulakatCard', 'RamazanCard', 'SporCard']) {
      const src = read(`features/modes/components/modes/${f}.tsx`);
      // Mod kartları bugünü hiç saymaz (Y-2: Hedefler'de bugün yalnız durum kartının satırında).
      expect(`${f}: ${src.includes('planHabits.length + wkTasks.length')}`).toBe(`${f}: false`);
      expect(`${f}: ${src.includes('progDone')}`).toBe(`${f}: false`);
    }
    expect(read('app/modlar.tsx')).not.toContain('const mkToday');
    expect(read('app/modlar.tsx')).toContain('modeToday(');
    expect(read('features/modes/hooks/useActiveModeSummary.ts')).toContain('modeToday(');
    expect(read('features/modes/components/ModeRoadmap.tsx')).not.toContain('e.todayTotal + e.habitCount');
  });
});

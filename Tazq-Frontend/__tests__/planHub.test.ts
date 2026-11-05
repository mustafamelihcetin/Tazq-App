import fs from 'fs';
import path from 'path';
import { activePlans, planHasItems, withoutGoalName } from '@/features/modes/utils/planSlots';
import { planInsight } from '@/features/modes/utils/planInsight';
import { PLAN_COPY, PLAN_PURPOSE } from '@/features/modes/components/plan/planCopy';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { ramazan: false, examMode: false, examName: '', examDate: null, exam2Name: '', exam2Date: null, exam3Name: '', exam3Date: null, tezMode: false, tezName: '', tezDate: null, mulakatMode: false, mulakatName: '', mulakatDate: null, mulakat2Name: '', mulakat2Date: null, mulakat3Name: '', mulakat3Date: null, sporMode: false, sporGoal: '', sporDate: null, spor2Goal: '', spor2Date: null, spor3Goal: '', spor3Date: null, tasarrufMode: false, tasarrufName: '', tasarrufDate: null, birakmaMode: false, birakmaName: '' };

describe('Planım: her hedefin tek girişi', () => {
  it('yalnız planı başlamış hedefler listelenir, en yakın tarih önde', () => {
    const p = { seasonal: { ...base, examMode: true, examName: 'DGS', examDate: '2027-07-18', tezMode: true, tezName: 'Tez', tezDate: '2027-01-27', sporMode: true, sporGoal: 'Koşu', sporDate: '2027-02-01' }, examPlanHabitIds: ['h'], tezPlanTaskIds: [1], sporPlanHabitIds: [], sporPlanTaskIds: [] };
    expect(activePlans(p as never).map(x => x.slot)).toEqual(['tez', 'exam']);
  });
  it('tarihsiz hedef de görünür, sonda', () => {
    const p = { seasonal: { ...base, birakmaMode: true, birakmaName: 'Sigara', tezMode: true, tezName: 'Tez', tezDate: '2027-01-27' }, birakmaPlanHabitIds: ['h'], tezPlanHabitIds: ['t'] };
    expect(activePlans(p as never).map(x => x.slot)).toEqual(['tez', 'birakma']);
  });
  it('ögesi olmayan plan başlamamış sayılır', () => {
    expect(planHasItems({ seasonal: base as never, tezPlanHabitIds: [], tezPlanTaskIds: [] }, 'tez')).toBe(false);
  });
  it('yedi modun hepsi plan cümlesi ve ad taşır, iki dilde', () => {
    for (const t of ['exam', 'tez', 'mulakat', 'spor', 'ramazan', 'tasarruf', 'birakma'] as const) {
      expect(PLAN_PURPOSE[t].tr).toBeTruthy();
      expect(PLAN_PURPOSE[t].en).toBeTruthy();
      expect(PLAN_COPY.tr.types[t]).toBeTruthy();
      expect(PLAN_COPY.en.types[t]).toBeTruthy();
    }
  });
  it('eski iki giriş kalktı: "İçgörü & Önizle" ve ayrı çalışma planı bağlantısı yok', () => {
    for (const f of ['Exam', 'Tez', 'Mulakat', 'Spor']) {
      const src = read(`features/modes/components/modes/${f}Card.tsx`);
      expect(src).not.toContain('İçgörü & Önizle');
      expect(src).toContain('<PlanLink slot=');
      expect(src).not.toContain('Planım ›');
    }
    expect(read('features/modes/components/modes/ExamCard.tsx')).not.toContain('StudyPlanLink');
    expect(fs.existsSync(path.join(__dirname, '..', 'app/sinav-plani.tsx'))).toBe(false);
  });
  it('tasarruf, bırakma ve Ramazan da Planım a bağlanır', () => {
    for (const f of ['Tasarruf', 'Birakma', 'Ramazan']) expect(read(`features/modes/components/modes/${f}Card.tsx`)).toContain('<PlanLink');
  });
});

describe('görev satırı', () => {
  it('hedef adı tekrar etmez', () => {
    expect(withoutGoalName('DenemeProje — Veri Analizi: düzelt', 'DenemeProje')).toBe('Veri Analizi: düzelt');
    expect(withoutGoalName('DenemeProje: bu hafta ne yaptın', 'DenemeProje')).toBe('Bu hafta ne yaptın');
    expect(withoutGoalName('Başka görev', 'DenemeProje')).toBe('Başka görev');
    expect(withoutGoalName('DenemeProje', 'DenemeProje')).toBe('DenemeProje');
  });
});

describe('plan yorumu', () => {
  const input = { type: 'exam', tr: true, planHabits: [{ createdAt: '2020-01-01', completedDates: ['2020-01-02'] }], avgHabitWeekPct: 50, completedPlanTasks: 1, totalPlanTasks: 4 };
  it('bugün bitince kutlar, seride seriyi söyler', () => {
    expect(planInsight({ ...input, planHabitStats: [{ doneToday: true, streak: 0 }] })).toMatch(/Harika/);
    expect(planInsight({ ...input, planHabitStats: [{ doneToday: false, streak: 5 }] })).toMatch(/5 günlük/);
  });
  it('tüm modlar için cümle üretir', () => {
    for (const type of ['exam', 'tez', 'mulakat', 'spor', 'ramazan', 'tasarruf', 'birakma']) {
      const t = planInsight({ ...input, type, planHabitStats: [{ doneToday: false, streak: 0 }] });
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(10);
    }
  });
});

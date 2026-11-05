import fs from 'fs';
import path from 'path';
import { belongsToSlot, foreignTaskIds, goalDay, groupByType, useCompactGoals } from '../features/modes/utils/goalRows';

const TODAY = '2026-11-05';
const task = (id: number, over: Record<string, unknown> = {}) => ({ id, title: `Görev ${id}`, dueDate: `${TODAY}T09:00:00`, isCompleted: false, tags: ['spor'], ...over });

describe('goalDay', () => {
  it('bugünün işlerini ve rutinleri sayar, sıradaki işi söyler', () => {
    const r = goalDay('spor', ['h1', 'h2'], [], [task(1, { isCompleted: true }), task(2)], [{ id: 'h1', completedDates: [TODAY] }, { id: 'h2', completedDates: [] }], TODAY);
    expect(r).toEqual({ done: 2, total: 4, next: 'Görev 2' });
  });
  it('gelecek görevi saymaz, gecikmişi sayar', () => {
    const r = goalDay('spor', [], [], [task(1, { dueDate: '2026-11-09T09:00:00' }), task(2, { dueDate: '2026-11-01T09:00:00' })], [], TODAY);
    expect(r).toMatchObject({ total: 1, next: 'Görev 2' });
  });
  it('dün biten görev bugünün yükü değildir; arşivlenen ve başka hedefin görevi sayılmaz', () => {
    const r = goalDay('spor', [], [], [task(1, { dueDate: '2026-11-04T09:00:00', isCompleted: true }), task(2, { isArchived: true }), task(3, { tags: ['tez'] })], [], TODAY);
    expect(r.total).toBe(0);
  });
  it('ara verilen rutin sayılmaz', () => {
    expect(goalDay('spor', ['h'], [], [], [{ id: 'h', pausedAt: '2026-11-01', completedDates: [] }], TODAY).total).toBe(0);
  });
});

describe('görevin sahibi', () => {
  it('ikinci sınavın görevi birinci sınavın satırına düşmez', () => {
    const tasks = [task(1, { tags: ['exam'], title: 'IELTS: kitap al' }), task(2, { tags: ['exam'], title: 'DGS işi' })];
    const foreign = foreignTaskIds('exam', { exam2PlanTaskIds: [1] });
    expect(goalDay('exam', [], [], tasks, [], TODAY, foreign)).toMatchObject({ total: 1, next: 'DGS işi' });
  });
  it('listede olmayan etiketli görev yine tanınır; kendi listesindeki sayılır', () => {
    expect(belongsToSlot({ id: 9, tags: ['exam'] }, 'exam', [], new Set())).toBe(true);
    expect(belongsToSlot({ id: 1, tags: ['exam'] }, 'exam2', [1], new Set())).toBe(true);
    expect(belongsToSlot({ id: 1, tags: ['tez'] }, 'exam', [], new Set())).toBe(false);
  });
});

describe('sayaç', () => {
  it('kare gelmese bile son değer yazılır', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'shared/hooks/useCountUp.ts'), 'utf8');
    expect(src).toContain('setTimeout(() => { cancelAnimationFrame(frame); setValue(target);');
    // Gerçek sayıyla başlar: JS meşgulken ekranda 0 kalmaz.
    expect(src).toContain('useState(target)');
    expect(src).toContain('MOUNT_GRACE_MS');
  });
});

describe('satır düzeni', () => {
  it('tek hedef kart olarak kalır; ikinciyle satıra geçer; tur açıkken kartlar açık', () => {
    expect(useCompactGoals(1, false)).toBe(false);
    expect(useCompactGoals(2, false)).toBe(true);
    expect(useCompactGoals(4, true)).toBe(false);
  });
  it('aynı türün satırları yan yana, en yakın hedefin türü önde', () => {
    const rows = [{ type: 'exam', k: 1 }, { type: 'tez', k: 2 }, { type: 'exam', k: 3 }];
    expect(groupByType(rows).map(r => r.k)).toEqual([1, 3, 2]);
  });
  it('satırda tek eylem var; kapatma yalnız o hedefi kapatır, kart kendi kodunu çalıştırır', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const rows = read('features/modes/components/GoalRows.tsx');
    expect(rows).not.toContain('c.edit');
    expect(rows).toContain('open={isOpen && lastOfType(i)}');
    const plan = read('app/plan.tsx');
    expect(plan).toContain('useGoalCloseStore.getState().request(plan.slot)');
    expect(plan).toContain('c.closeConfirmTitle(title)');
    const card = (f: string) => read(`features/modes/components/modes/${f}Card.tsx`);
    for (const f of ['Exam', 'Mulakat', 'Spor']) expect(card(f)).toContain('useCloseRequest(slot, del)');
    for (const f of ['Exam', 'Tez', 'Mulakat', 'Spor', 'Ramazan', 'Tasarruf', 'Birakma']) expect(card(f)).toContain('useCloseRequest(');
    expect(card('Exam')).toContain('if (exam2Complete || exam3Complete) delSlot1()');
  });
  it('kapatma isteği yalnız kendi yuvasına gider ve bir kez çalışır', () => {
    const { useGoalCloseStore } = require('../features/modes/store/useGoalCloseStore');
    useGoalCloseStore.getState().request('exam2');
    expect(useGoalCloseStore.getState().slot).toBe('exam2');
    useGoalCloseStore.getState().clear();
    expect(useGoalCloseStore.getState().slot).toBeNull();
  });
  it('görev sırası sabit: biten görev yer değiştirmez', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/modes/components/plan/PlanToday.tsx'), 'utf8');
    expect(src).toContain('|| a.id - b.id)');
  });
  it('tablette satır grubu yarım sütuna sarılmaz', () => {
    expect(fs.readFileSync(path.join(__dirname, '..', 'app/modlar.tsx'), 'utf8')).toContain('{tablet && !compactGoals ? (');
  });
  it('gizli kart bağlı kalır: kapanış ritüeli kartın içinde çalışıyor', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/modes/components/GoalRows.tsx'), 'utf8');
    expect(src).toContain("display: isOpen ? 'flex' : 'none'");
    expect(src).not.toMatch(/\{isOpen && card/);
  });
});

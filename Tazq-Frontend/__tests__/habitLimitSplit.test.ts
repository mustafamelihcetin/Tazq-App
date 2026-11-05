import { keepOrder } from '@/features/habits/utils/habitSchedule';
import { manualRoutineRoom, roomLeft, modeRoomLeft, modeOf, routinesToRest } from '@/features/habits/utils/habitLimit';
import { useBudgetStore } from '@/shared/store/useBudgetStore';

const h = (id: string, planMode?: string, completedDates: string[] = []) => ({ id, planMode, completedDates, pausedAt: null, createdAt: '2026-01-01' }) as never;

describe('kişisel ve mod rutinleri ayrı sayılır (2026-11-05)', () => {
  it('mod rutinleri kişisel sınırı doldurmaz', () => {
    expect(roomLeft([h('a'), h('b'), h('c'), h('x', 'exam'), h('y', 'spor')])).toBe(4);
  });
  it('3 kişisel alışkanlık moda engel olmaz', () => {
    expect(modeRoomLeft([h('a'), h('b'), h('c')], 'exam')).toBe(2);
  });
  it('mod başına 2, toplam 4', () => {
    expect(modeRoomLeft([h('1', 'exam'), h('2', 'exam2')], 'exam')).toBe(0);
    // Bütçe dolu ama tez'in hiç rutini yok: hiçbir hedef rutinsiz kalmaz (kullanıcı: "3 mod açılsa limit doluyor").
    expect(modeRoomLeft([h('1', 'exam'), h('2', 'exam'), h('3', 'spor'), h('4', 'spor')], 'tez')).toBe(1);
    // Bütçe dolu, hedefin bir rutini var: otomatik ekleme durur, elle ekleme açık.
    expect(modeRoomLeft([h('1', 'exam'), h('2', 'exam'), h('3', 'spor'), h('4', 'spor'), h('5', 'tez')], 'tez')).toBe(0);
    expect(manualRoutineRoom([h('1', 'exam'), h('2', 'exam'), h('3', 'spor'), h('4', 'spor'), h('5', 'tez')], 'tez')).toBe(1);
    expect(manualRoutineRoom([h('1', 'tez'), h('2', 'tez')], 'tez')).toBe(0);
    expect(modeRoomLeft([h('1', 'exam')], 'exam2')).toBe(1);
  });
  it('eski kimlikler de mod sayılır', () => {
    expect(modeOf({ id: 'habit_kpss_1' })).toBe('exam');
    expect(modeOf({ id: 'habit_1793_abc' })).toBeNull();
  });
  it('fazlalar dinlendirilir, en çok yapılan kalır, kişisele dokunulmaz', () => {
    const today = new Date(2026, 10, 5);
    const rest = routinesToRest([h('p'), h('e1', 'exam', ['2026-11-04', '2026-11-03']), h('e2', 'exam', ['2026-11-04']), h('e3', 'exam')], today) as unknown as { id: string }[];
    expect(rest.map(x => x.id)).toEqual(['e3']);
  });
});

describe('bütçe hareketleri', () => {
  beforeEach(() => { useBudgetStore.getState().reset(); useBudgetStore.getState().setStartAmount('100'); });
  const bal = () => useBudgetStore.getState().log[0].amount;
  it('aynı gün art arda eklenir ve çıkarılır', () => {
    useBudgetStore.getState().adjust(50);
    useBudgetStore.getState().adjust(-20);
    expect(bal()).toBe(130);
  });
  it('sıfırın altına inmez, geri alma gerçekleşen miktarı geri koyar', () => {
    const at = useBudgetStore.getState().adjust(-500);
    expect(bal()).toBe(0);
    useBudgetStore.getState().undoMove(at);
    expect(bal()).toBe(100);
  });
});

describe('iki ayrı hesap', () => {
  it('hedef rutinleri kişisel hakkı yemez: 6 hedef açıkken de 7 kişisel eklenir', () => {
    const goals = ['exam', 'tez', 'mulakat', 'spor', 'tasarruf', 'birakma'].flatMap(m => [h(`${m}1`, m), h(`${m}2`, m)]);
    expect(roomLeft(goals)).toBe(7);
  });
  it('fazla rutin dinlenirken hiçbir hedef rutinsiz kalmaz', () => {
    const modes = ['exam', 'tez', 'spor', 'birakma', 'tasarruf', 'mulakat'];
    const all = modes.flatMap(m => [h(`${m}1`, m), h(`${m}2`, m)]);
    const rest = new Set((routinesToRest(all as never[]) as { id: string }[]).map(x => x.id));
    for (const m of modes) expect([`${m}1`, `${m}2`].some(id => !rest.has(id))).toBe(true);
    expect(all.length - rest.size).toBe(6);
  });
  it('elle eklemeyi toplam sayı engellemez', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../app/cockpit.tsx'), 'utf8');
    expect(src).not.toContain('MAX_HABITS');
  });
});

describe('ekran açıkken sıra sabit', () => {
  const ids = (x: { id: string }[]) => x.map(h => h.id);
  it('işaretlenen sona kaysa da gösterilen sıra değişmez, yeni olan sona eklenir, kalkan düşer', () => {
    expect(ids(keepOrder(['a', 'b', 'c'], [{ id: 'b' }, { id: 'c' }, { id: 'a' }]))).toEqual(['a', 'b', 'c']);
    expect(ids(keepOrder(['a', 'b'], [{ id: 'b' }, { id: 'x' }, { id: 'a' }]))).toEqual(['a', 'b', 'x']);
    expect(ids(keepOrder(['a', 'b', 'c'], [{ id: 'c' }, { id: 'a' }]))).toEqual(['a', 'c']);
  });
});

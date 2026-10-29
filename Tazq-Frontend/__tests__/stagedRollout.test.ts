/**
 * Madde 4 — kademeli açılım. Mod açılışında 3 alışkanlık + 3-4 görev bir anda
 * yığılıyordu. Kullanıcı kararı (2026-10-29): ilk gün 1 görev + 1 alışkanlık; kalanlar
 * bir önceki gün en az bir plan işi tamamlandıysa günde birer birer açılır.
 */
import { splitForFirstDay, interleaveStaged, planCompletedOn, canUnlockToday } from '@/features/modes/utils/stagedRollout';

const h = (name: string) => ({ name });
const t = (title: string, priority: 'High' | 'Medium' | 'Low', tags: string[] = []) => ({ title, priority, tags });

describe('ilk gün ayrımı', () => {
  it('1 alışkanlık + en önemli görev şimdi, gerisi sıraya', () => {
    const r = splitForFirstDay([h('A'), h('B'), h('C')], [t('m', 'Medium'), t('h1', 'High'), t('h2', 'High'), t('l', 'Low')]);
    expect(r.habitsNow.map(x => x.name)).toEqual(['A']);
    expect(r.tasksNow.map(x => x.title)).toEqual(['h1']);
    expect(r.habitsLater.map(x => x.name)).toEqual(['B', 'C']);
    expect(r.tasksLater.map(x => x.title)).toEqual(['h2', 'm', 'l']); // öncelik sırası
  });

  it('kilo girişi zinciri ve tarihi sabit görevler sıraya girmez — kendi akışları var', () => {
    const r = splitForFirstDay([], [t('Tartı', 'Low', ['weight_entry']), t('a', 'High'), t('b', 'Medium')], { pinned: (x) => x.tags.includes('weight_entry') });
    expect(r.tasksNow.map(x => x.title)).toEqual(['a', 'Tartı']);
    expect(r.tasksLater.map(x => x.title)).toEqual(['b']);
  });

  it('boş şablon çökmez', () => {
    expect(splitForFirstDay([], [])).toEqual({ habitsNow: [], tasksNow: [], habitsLater: [], tasksLater: [] });
  });
});

describe('sıra düzeni', () => {
  it('görev ve alışkanlık dönüşümlü — gün gün tek tür yığılmaz', () => {
    const q = interleaveStaged(['t2', 't3', 't4'], ['h2']);
    expect(q).toEqual([{ kind: 'task', item: 't2' }, { kind: 'habit', item: 'h2' }, { kind: 'task', item: 't3' }, { kind: 'task', item: 't4' }]);
  });
});

describe('ilerleme kapısı', () => {
  const habits = [{ id: 'h1', completedDates: ['2026-10-28'] }, { id: 'x', completedDates: ['2026-10-28'] }];
  const tasks = [{ id: 7, isCompleted: true, completedAt: new Date(2026, 9, 28, 15).toISOString() }];

  it('plan alışkanlığı o gün işaretlendiyse tamamlama var', () => {
    expect(planCompletedOn('2026-10-28', ['h1'], [], habits, [])).toBe(true);
  });
  it('plan görevi o gün bittiyse tamamlama var', () => {
    expect(planCompletedOn('2026-10-28', [], [7], [], tasks)).toBe(true);
  });
  it('başka planın işi sayılmaz', () => {
    expect(planCompletedOn('2026-10-28', ['h9'], [8], habits, tasks)).toBe(false);
  });

  it('günde EN FAZLA bir açılım', () => {
    expect(canUnlockToday({ items: [1], lastUnlockDay: '2026-10-29' }, '2026-10-29')).toBe(false);
    expect(canUnlockToday({ items: [1], lastUnlockDay: '2026-10-28' }, '2026-10-29')).toBe(true);
    expect(canUnlockToday({ items: [], lastUnlockDay: null }, '2026-10-29')).toBe(false);
  });
});

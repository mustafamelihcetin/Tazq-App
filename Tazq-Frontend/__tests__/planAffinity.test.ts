import { buildDailyTasks, type DailyPlanSpec } from '../features/modes/utils/dailyPlanEngine';
import { KILO_LIBRARY } from '../features/modes/data/planLibrary';
import { affinityKey, hasSignal, mergeAffinity, NEGATIVE, pickByAffinity, withDone, withNegative, withShown, type PlanAffinity } from '../features/modes/utils/planAffinity';
import { diffCompletions } from '../features/modes/store/usePlanAffinityStore';

const FOOD = 'spor_kilo_beslenme';
const areaOf = new Map(KILO_LIBRARY.map(t => [t.tr, t.area]));
const spec: DailyPlanSpec = { kind: 'kilo', slot: 'spor', name: 'Kilo', daysLeft: 3650, dailyMinutes: 180 };
const DAY = 86400000;
const START = Date.UTC(2026, 0, 1, 12);

// Sabit tohumlu sahte kullanıcı: testin sonucu çalıştırmaya göre değişmez.
const coin = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

function simulate(days: number, likesFood: boolean) {
  let affinity: PlanAffinity = {};
  const shown: { day: number; tr: string; area?: string }[] = [];
  let i = 0;
  for (let d = 0; d < days; d++) {
    const today = new Date(START + d * DAY);
    const dayNo = Math.floor(today.getTime() / DAY);
    const tasks = buildDailyTasks({ ...spec, affinity }, [], 'tr', today) as unknown as { titleTr: string }[];
    affinity = withShown(affinity, tasks.map(t => affinityKey(t.titleTr)), dayNo);
    for (const t of tasks) {
      const area = areaOf.get(t.titleTr);
      shown.push({ day: d, tr: t.titleTr, area });
      const wants = likesFood ? area === FOOD : area !== FOOD;
      if (coin(++i) < (wants ? 0.9 : 0.1)) affinity = withDone(affinity, affinityKey(t.titleTr), 1);
      else affinity = withNegative(affinity, affinityKey(t.titleTr), wants ? NEGATIVE.ignored : NEGATIVE.swap);
    }
  }
  return { shown, affinity };
}

const foodShare = (list: { area?: string }[]) => list.filter(x => x.area === FOOD).length / Math.max(1, list.length);

describe('planAffinity: sahte kullanıcıyla 60 gün', () => {
  const food = simulate(60, true);
  const other = simulate(60, false);
  const late = (r: typeof food) => r.shown.filter(x => x.day >= 30);

  it('beslenme görevi yapan kullanıcıya beslenme daha sık gelir, yapmayana daha seyrek', () => {
    expect(foodShare(late(food))).toBeGreaterThan(foodShare(late(other)) + 0.2);
  });
  it('tek tipe kilitlenmez: istemediği alanlar da ara ara gelir', () => {
    const nonFood = late(food).filter(x => x.area !== FOOD);
    expect(nonFood.length).toBeGreaterThan(0);
  });
  it('sevilen görev bile peş peşe gelmez', () => {
    const lastDay = new Map<string, number>();
    for (const x of food.shown) {
      const prev = lastDay.get(x.tr);
      if (prev != null && prev !== x.day) expect(x.day - prev).toBeGreaterThan(1);
      lastDay.set(x.tr, x.day);
    }
  });
});

describe('planAffinity: kurallar', () => {
  const pool = [{ tr: 'A', en: 'A', area: 'x' }, { tr: 'B', en: 'B', area: 'x' }, { tr: 'C', en: 'C', area: 'y' }, { tr: 'D', en: 'D', area: 'y' }];
  const opts = { name: '', day: 100 };

  it('sinyal yoksa eski sırayla aynı görevler gelir', () => {
    const today = new Date(START);
    expect(buildDailyTasks({ ...spec, affinity: {} }, [], 'tr', today)).toEqual(buildDailyTasks(spec, [], 'tr', today));
    expect(hasSignal({ x: { d: 0, n: 0, s: 3 } })).toBe(false);
  });
  it('aynı gün aynı sonuç', () => {
    const affinity = withDone({}, affinityKey('A'), 3);
    expect(pickByAffinity(pool, 2, { ...opts, affinity })).toEqual(pickByAffinity(pool, 2, { ...opts, affinity }));
  });
  it('alan bilgisi, hiç gösterilmemiş görevi de öne çeker', () => {
    let affinity: PlanAffinity = {};
    affinity = withDone(affinity, affinityKey('A'), 20);
    affinity = withNegative(affinity, affinityKey('C'), 20);
    const withArea = Array.from({ length: 50 }, (_, i) => pickByAffinity(pool, 4, { name: '', day: i, affinity }).map(p => p.tr));
    const bBeatsD = withArea.filter(o => o.indexOf('B') < o.indexOf('D')).length;
    expect(bBeatsD).toBeGreaterThan(35);
  });
  it('yakında gösterilen görev sona gider, küçük havuz tıkanmaz', () => {
    const affinity = withShown(withDone({}, affinityKey('A'), 10), [affinityKey('A')], 99);
    expect(pickByAffinity(pool, 1, { ...opts, affinity })[0].tr).not.toBe('A');
    expect(pickByAffinity(pool.slice(0, 1), 1, { ...opts, affinity })[0].tr).toBe('A');
  });
  it('geri alma sayıyı düşürür, eksiye inmez', () => {
    const k = affinityKey('A');
    expect(withDone(withDone({}, k, 1), k, -1)[k].d).toBe(0);
    expect(withDone({}, k, -1)[k].d).toBe(0);
  });
  it('cihazlar birleşince yüksek sayı kalır', () => {
    expect(mergeAffinity({ a: { d: 2, n: 0 } }, { a: { d: 1, n: 3, s: 9 }, b: { d: 1, n: 0 } })).toEqual({ a: { d: 2, n: 3, s: 9 }, b: { d: 1, n: 0 } });
  });
});

describe('diffCompletions', () => {
  const daily = (id: number, isCompleted: boolean) => ({ id, isCompleted, title: 'Yürü', description: JSON.stringify({ tr: 'Yürü' }), tags: ['spor', 'daily', 'fitness'] });
  it('bitirmeyi ve geri almayı sayar', () => {
    expect(diffCompletions(new Map([[1, false]]), [daily(1, true)])).toEqual([{ slot: 'spor', key: affinityKey('Yürü'), delta: 1 }]);
    expect(diffCompletions(new Map([[1, true]]), [daily(1, false)])[0].delta).toBe(-1);
  });
  it('başka cihazda bitmiş, ilk kez gelen görevi saymaz', () => {
    expect(diffCompletions(new Map(), [daily(1, true)])).toEqual([]);
  });
  it('kullanıcının kendi eklediği görevi saymaz', () => {
    expect(diffCompletions(new Map([[1, false]]), [{ id: 1, isCompleted: true, title: 'X', tags: ['spor'] }])).toEqual([]);
  });
});

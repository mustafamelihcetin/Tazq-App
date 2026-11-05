import { desiredDailyCount } from '../features/modes/utils/dailyPlanEngine';
import { goalStateOf, GOAL_STATES } from '../features/modes/utils/goalRows';
import { PLAN_COPY } from '../features/modes/components/plan/planCopy';
import { areaLeanings, bandOf, emptyRhythm, hasRhythmInsight, isLightDay, mergeRhythm, topBand, withDoneAt, withShownDay, type Rhythm } from '../features/modes/utils/planLearner';
import { affinityKey, withDone, withNegative } from '../features/modes/utils/planAffinity';

const TUESDAY = 2;

/** Salıları yapmayan, akşamları çalışan kullanıcı. weeks hafta yaşatır. */
function live(weeks: number, skips = TUESDAY, start: Rhythm = emptyRhythm(), startDay = 1000) {
  let r = start;
  for (let d = 0; d < weeks * 7; d++) {
    const day = startDay + d;
    const wd = d % 7;
    r = withShownDay(r, wd, 2, day);
    if (wd !== skips) { r = withDoneAt(r, wd, 20, 1, day); r = withDoneAt(r, wd, 20, 1, day); }
  }
  return r;
}

describe('kullanıcıyı tanıma', () => {
  it('ilk günlerde konuşmaz: az veriyle plan değişmez', () => {
    expect(isLightDay(live(1), TUESDAY)).toBe(false);
    expect(hasRhythmInsight(emptyRhythm())).toBe(false);
  });
  it('haftalar geçtikçe zayıf günü öğrenir, diğer günleri cezalandırmaz', () => {
    const r = live(6);
    expect(isLightDay(r, TUESDAY)).toBe(true);
    for (const d of [0, 1, 3, 4, 5, 6]) expect(isLightDay(r, d)).toBe(false);
  });
  it('alışkanlık değişince unutur: salılar düzelince hafif gün kalkar', () => {
    const before = live(6);
    expect(isLightDay(before, TUESDAY)).toBe(true);
    const after = live(12, -1, before, 1000 + 42);
    expect(isLightDay(after, TUESDAY)).toBe(false);
  });
  it('her gün aynı düşüklükteyse tek güne ceza yok', () => {
    let r = emptyRhythm();
    for (let d = 0; d < 42; d++) { r = withShownDay(r, d % 7, 2, 1000 + d); if (d % 5 === 0) r = withDoneAt(r, d % 7, 9, 1, 1000 + d); }
    expect([0, 1, 2, 3, 4, 5, 6].some(d => isLightDay(r, d))).toBe(false);
  });
  it('en çok bitirdiği dilimi bulur; dağınıksa iddia etmez', () => {
    expect(topBand(live(4))).toBe(bandOf(20));
    let mixed = emptyRhythm();
    for (const h of [8, 13, 19, 23, 8, 13, 19, 23]) mixed = withDoneAt(mixed, 1, h, 1, 1000);
    expect(topBand(mixed)).toBeNull();
  });
  it('gece yarısından sonrası gece sayılır', () => {
    expect(bandOf(2)).toBe(3);
    expect(bandOf(23)).toBe(3);
    expect(bandOf(8)).toBe(0);
  });
  it('geri alma sayıyı düşürür, eksiye inmez', () => {
    const r = withDoneAt(emptyRhythm(), 1, 9, -1, 1000);
    expect(r.done[1]).toBe(0);
  });
  it('hafif gün yükü bir azaltır, sıfıra indirmez, hiç artırmaz', () => {
    const base = { kind: 'kilo' as const, daysLeft: 100, dailyMinutes: 180 };
    expect(desiredDailyCount({ ...base, lightDay: true })).toBe(desiredDailyCount(base) - 1);
    expect(desiredDailyCount({ ...base, dailyMinutes: 30, lightDay: true })).toBe(1);
  });
  it('alan eğilimi yeterli işaretle söylenir', () => {
    const pool = [{ tr: 'Su iç', en: 'x', area: 'food' }, { tr: 'Koş', en: 'y', area: 'run' }];
    let a = withDone({}, affinityKey('Su iç'), 3);
    a = withNegative(a, affinityKey('Koş'), 3);
    expect(areaLeanings(pool, a, '')).toEqual({ favorite: 'food', avoided: 'run' });
    expect(areaLeanings(pool, withDone({}, affinityKey('Su iç'), 1), '')).toEqual({ favorite: null, avoided: null });
  });
  it('cihazlar birleşince yeni olan kalır', () => {
    const old = { ...emptyRhythm(), at: 10 };
    const fresh = { ...emptyRhythm(), at: 20 };
    expect(mergeRhythm(old, fresh).at).toBe(20);
    expect(mergeRhythm(undefined, fresh).at).toBe(20);
  });
});

describe('hedefin durumu: açıkta kalan yok', () => {
  const base = { paused: false, restToday: false, daysLeft: 10, done: 0, total: 2 };
  it.each([
    [{ ...base }, 'active'],
    [{ ...base, done: 2 }, 'allDone'],
    [{ ...base, total: 0 }, 'empty'],
    [{ ...base, daysLeft: null, total: 0 }, 'empty'],
    [{ ...base, restToday: true, total: 0 }, 'rest'],
    [{ ...base, daysLeft: -1 }, 'passed'],
    [{ ...base, paused: true, daysLeft: -1 }, 'paused'],
    [{ ...base, paused: true, done: 2 }, 'paused'],
  ])('%j → %s', (input, expected) => {
    expect(goalStateOf(input)).toBe(expected);
  });
  it('her durumun iki dilde cümlesi var', () => {
    for (const lang of ['tr', 'en'] as const) for (const s of GOAL_STATES) {
      const line = PLAN_COPY[lang].goals.state[s];
      if (s !== 'active') expect(line.length).toBeGreaterThan(5);
    }
  });
  it('kapatma isteği kart bulunamazsa bekleyip sonradan tetiklenmez', () => {
    const { closeRequestFresh } = require('../features/modes/store/useGoalCloseStore');
    const now = 100000;
    expect(closeRequestFresh(now - 1000, now)).toBe(true);
    expect(closeRequestFresh(now - 60000, now)).toBe(false);
  });
});

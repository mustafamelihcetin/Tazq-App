import { budgetFor, isEidDay, ramadanFrame, studyBlockWindow, studyFactor, windowOf, possibleWhileFasting, reliefFactorFor, FASTING_BUDGET, WINDOW_ORDER } from '../features/modes/utils/ramadanBrain';
import { allocatePlanBudget, buildDailyTasks, desiredDailyCount, dailyPool } from '../features/modes/utils/dailyPlanEngine';
import { capOf, emptyCore, syncCore } from '../features/studyplan/utils/planCore';
import { dayKeyOf, dayNum } from '../features/studyplan/utils/scheduler';
import { LIBRARY_BY_KIND } from '../features/modes/data/planLibrary';
import { PLAN_COPY } from '../features/modes/components/plan/planCopy';

const on = { modeOn: true, isActive: true, daysRemaining: 20, notFasting: false, notFastingToday: false };

describe('çerçeve', () => {
  it('dönem içinde oruçlu: düzen çalışır; son on günde aşama değişir', () => {
    expect(ramadanFrame(on)).toEqual({ inMonth: true, fasting: true, phase: 'month' });
    expect(ramadanFrame({ ...on, daysRemaining: 5 }).phase).toBe('last10');
  });
  it('oruç tutmayan kişide düzen durur, Ramazan görevleri kalır', () => {
    expect(ramadanFrame({ ...on, notFasting: true })).toMatchObject({ inMonth: true, fasting: false });
    expect(ramadanFrame({ ...on, notFastingToday: true }).fasting).toBe(false);
  });
  it('mod kapalıysa ya da dönem dışında hiçbir şey değişmez', () => {
    expect(ramadanFrame({ ...on, modeOn: false })).toMatchObject({ inMonth: false, fasting: false, phase: 'none' });
    expect(ramadanFrame({ ...on, isActive: false }).fasting).toBe(false);
  });
});

describe('bayram', () => {
  it('dönem bitince üç gün bayram: bütçe iki, oruç yok', () => {
    const ranges = [{ end: '2027-03-08' }];
    expect(isEidDay('2027-03-08', ranges, dayNum)).toBe(false);
    expect(isEidDay('2027-03-09', ranges, dayNum)).toBe(true);
    expect(isEidDay('2027-03-11', ranges, dayNum)).toBe(true);
    expect(isEidDay('2027-03-12', ranges, dayNum)).toBe(false);
    const f = ramadanFrame({ ...on, isActive: false, isEid: true });
    expect(f).toMatchObject({ phase: 'eid', fasting: false });
    expect(budgetFor(f, 4)).toBe(2);
    expect(budgetFor(ramadanFrame(on), 4)).toBe(3);
    expect(budgetFor(ramadanFrame({ ...on, notFasting: true }), 4)).toBe(4);
  });
  it('sınav bloğu vakti: yeni konu sahurda, tekrar gün içinde', () => {
    expect(studyBlockWindow('yeni')).toBe('sahur');
    expect(studyBlockWindow('tekrar')).toBe('day');
  });
});

describe('ortak akıl: plan başına etki', () => {
  const kilo = { kind: 'kilo' as const, slot: 'spor', daysLeft: 100, dailyMinutes: 180 };
  it('bedensel plan oruçta bir iş azalır, sıfıra inmez; zihinsel plan sayıca azalmaz', () => {
    expect(desiredDailyCount({ ...kilo, isRamazan: true })).toBe(desiredDailyCount(kilo) - 1);
    expect(desiredDailyCount({ ...kilo, dailyMinutes: 30, isRamazan: true })).toBe(1);
    const tez = { kind: 'tez' as const, slot: 'tez', daysLeft: 100, dailyMinutes: 180 };
    expect(desiredDailyCount({ ...tez, isRamazan: true })).toBe(desiredDailyCount(tez));
  });
  it('dört plan açıkken bile günün toplamı üçü geçmez, en yakın hedef önce alır', () => {
    const specs = [{ daysLeft: 200 }, { daysLeft: 20 }, { daysLeft: 90 }, { daysLeft: 300 }];
    const caps = allocatePlanBudget(specs, [2, 2, 2, 2], FASTING_BUDGET);
    expect(caps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FASTING_BUDGET);
    expect(caps[1]).toBeGreaterThan(0);
  });
  it('sınavda süre kısılır, sınava 30 gün kala kısılmaz', () => {
    expect(studyFactor('month', 120)).toBe(0.8);
    expect(studyFactor('last10', 120)).toBe(0.7);
    expect(studyFactor('month', 25)).toBe(1);
    expect(studyFactor('none', 120)).toBe(1);
  });
  it('oruçluyken görev havuzu çeşitli kalır: kütüphane korunur, olmayacak iş çıkar', () => {
    const pool = dailyPool({ kind: 'kilo', slot: 'spor', daysLeft: 100, isRamazan: true });
    expect(pool.length).toBeGreaterThan(10);
    for (const p of pool) expect(possibleWhileFasting(p.tr)).toBe(true);
  });
  it('oruçluyken kilo planı çalışır, görev etiketleri bozulmaz', () => {
    const tasks = buildDailyTasks({ kind: 'kilo', slot: 'spor', daysLeft: 100, dailyMinutes: 180, isRamazan: true }, [], 'tr', new Date(2027, 1, 10, 12));
    expect(tasks.length).toBeGreaterThan(0);
  });
});

describe('vakit', () => {
  it('bedensel iş gündüze düşmez', () => {
    for (const t of ['20 dakika tempolu yürü', '6 x 1 dakika hızlı, 2 dakika yavaş koş', 'Koşudan sonra 10 dakika esne']) expect(windowOf('spor', t)).toBe('iftar');
  });
  it('yemek ve su işi iftara', () => {
    for (const t of ['Tabağının yarısını sebzeyle doldur', 'Şekerli bir içeceği suyla değiştir']) expect(windowOf('spor', t)).toBe('iftar');
  });
  it('derin iş sahura, hafif iş güne', () => {
    expect(windowOf('tez', 'Veri Analizi: yazdığın bir bölümü bugün revize et')).toBe('sahur');
    expect(windowOf('exam', 'Sözcükte ve Cümlede Anlam çalış · 35 dk')).toBe('sahur');
    expect(windowOf('tasarruf', 'Haftalık harcamanı kontrol et')).toBe('day');
  });
  it('Ramazan işleri kendi vaktinde', () => {
    expect(windowOf('ramazan', 'Sahur alarmını kur')).toBe('sahur');
    expect(windowOf('ramazan', 'Teravihe git ya da evde iki rekat kıl')).toBe('night');
    expect(windowOf('ramazan', 'Bir kişiyi iftara davet et ya da ara')).toBe('iftar');
  });
  it('kütüphanedeki her görev bir vakte oturur, bedensel planda gündüz antrenman yok', () => {
    for (const [kind, list] of Object.entries(LIBRARY_BY_KIND)) for (const t of list) {
      expect(WINDOW_ORDER).toContain(windowOf(kind === 'kilo' || kind === 'maraton' || kind === 'guc' || kind === 'genel' ? 'spor' : kind, t.tr));
    }
    for (const t of LIBRARY_BY_KIND.maraton) if (/koş\b|koşu\b/i.test(t.tr) && !/planla|takvim|hesapla/i.test(t.tr)) expect(windowOf('spor', t.tr)).toBe('iftar');
  });
  it('her vaktin ve plan etkisinin iki dilde metni var', () => {
    for (const lang of ['tr', 'en'] as const) {
      const c = PLAN_COPY[lang].ramadan;
      for (const w of WINDOW_ORDER) expect(c.windows[w].length).toBeGreaterThan(2);
      for (const k of ['exam', 'tez', 'mulakat', 'spor', 'kilo', 'tasarruf', 'birakma', 'other'] as const) expect(c.effect[k].length).toBeGreaterThan(5);
    }
  });
});

describe('sınav takvimi Ramazan\'ı bilir', () => {
  const START = '2027-02-08';
  const END = '2027-03-08';
  const far = { slot: 'exam', name: 'DGS', date: '2027-07-18', dailyMinutes: 100 };
  const near = { slot: 'exam', name: 'DGS', date: '2027-03-01', dailyMinutes: 100 };
  it('dönem içi gün kapasitesi düşer, dışı aynı kalır', () => {
    const core = { ...syncCore(emptyCore(), [far], '2027-02-01', 1), relief: { start: START, end: END } };
    const cap = capOf(core);
    expect(cap(dayNum('2027-02-01'))).toBe(100);
    expect(cap(dayNum('2027-02-15'))).toBe(80);
    expect(cap(dayNum('2027-03-05'))).toBe(70);
    expect(cap(dayNum('2027-03-09'))).toBe(100);
  });
  it('yakın sınavda dönem içinde bile kısılmaz', () => {
    const core = { ...syncCore(emptyCore(), [near], '2027-02-10', 1), relief: { start: START, end: END } };
    expect(capOf(core)(dayNum('2027-02-15'))).toBe(100);
  });
  it('planlayıcı daha az dakika koyar; günler geçince yapılan iş kaybolmaz', () => {
    const noRelief = syncCore(emptyCore(), [far], '2027-02-10', 1);
    const withRelief = syncCore(emptyCore(), [far], '2027-02-10', 1, { relief: { start: START, end: END } });
    const load = (c: typeof noRelief) => (c.committed['2027-02-10'] ?? []).reduce((a, b) => a + b.min, 0);
    expect(load(withRelief)).toBeLessThan(load(noRelief));
    expect(load(withRelief)).toBeLessThanOrEqual(80);
  });
  it('düzen kapanınca plan normale döner', () => {
    const a = syncCore(emptyCore(), [far], '2027-02-10', 1, { relief: { start: START, end: END } });
    const b = syncCore(a, [far], '2027-02-10', 2, { relief: null });
    expect(b.relief ?? null).toBeNull();
    expect(capOf(b)(dayNum('2027-02-15'))).toBe(100);
  });
  it('saf çarpan', () => {
    expect(reliefFactorFor('2027-02-15', { start: START, end: END }, ['2027-07-18'], dayNum)).toBe(0.8);
    expect(reliefFactorFor('2027-02-15', null, [], dayNum)).toBe(1);
    expect(dayKeyOf(dayNum(START))).toBe(START);
  });
});

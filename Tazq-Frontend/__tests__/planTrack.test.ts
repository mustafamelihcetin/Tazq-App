import fs from 'fs';
import path from 'path';
import { activeKeys, dayStreak, kiloPace, quitView, ramadanCells, savingsView, weekGrid, weeksOnTarget } from '../features/modes/utils/planTrack';
import { useBudgetStore } from '../shared/store/useBudgetStore';

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const TODAY = '2026-11-05'; // perşembe

describe('para', () => {
  const base = { type: 'birikim', start: 1000, target: 11000, log: [], dateKey: '2027-05-05', today: TODAY };
  it('birikim: kalan, yüzde ve ayda gereken', () => {
    const v = savingsView({ ...base, log: [{ date: TODAY, amount: 3500 }] });
    expect(v).toMatchObject({ current: 3500, done: 2500, pct: 25, remaining: 7500, isDebt: false, reached: false });
    expect(v.needPerMonth).toBeGreaterThanOrEqual(1250);
    expect(v.needPerMonth).toBeLessThanOrEqual(1300);
  });
  it('borçta yön ters: bakiye düşünce ilerler, sıfırda biter', () => {
    const debt = { ...base, type: 'borc', start: 10000, target: 0 };
    expect(savingsView({ ...debt, log: [{ date: TODAY, amount: 7500 }] })).toMatchObject({ isDebt: true, done: 2500, pct: 25, remaining: 7500 });
    expect(savingsView({ ...debt, log: [{ date: TODAY, amount: 0 }] })).toMatchObject({ reached: true, needPerMonth: null, projected: null });
  });
  it('borç artarsa ilerleme eksiye düşmez', () => {
    expect(savingsView({ ...base, type: 'borc', start: 10000, target: 0, log: [{ date: TODAY, amount: 12000 }] }).pct).toBe(0);
  });
  it('tahmin en az iki kayıt ve bir hafta ister, ters giderse susar', () => {
    expect(savingsView({ ...base, log: [{ date: TODAY, amount: 2000 }] }).projected).toBeNull();
    expect(savingsView({ ...base, log: [{ date: '2026-11-03', amount: 1000 }, { date: TODAY, amount: 2000 }] }).projected).toBeNull();
    expect(savingsView({ ...base, log: [{ date: '2026-10-05', amount: 3000 }, { date: TODAY, amount: 1000 }] }).projected).toBeNull();
    const ok = savingsView({ ...base, log: [{ date: '2026-10-06', amount: 1000 }, { date: TODAY, amount: 3000 }] });
    expect(ok.projected).toBe('2027-03-05');
    expect(ok.onTime).toBe(true);
  });
  it('acil fon: ölçü güvence ayı', () => {
    expect(savingsView({ ...base, type: 'acilfon', start: 0, target: 60000, monthlyExpense: 10000, log: [{ date: TODAY, amount: 25000 }] }).coveredMonths).toBe(2.5);
    expect(savingsView({ ...base, type: 'acilfon' }).coveredMonths).toBeNull();
  });
  it('kumbara doluluğu elindeki paradır: başlangıç birikimi boş görünmez', () => {
    expect(savingsView({ ...base, start: 5000, target: 50000 }).fillPct).toBe(10);
    expect(savingsView({ ...base, start: 5000, target: 50000 }).pct).toBe(0);
  });
  it('para girilince haftalık giriş görevi kapanır', () => {
    expect(read('features/modes/components/plan/track/SavingsTrack.tsx')).toContain("includes('budget_entry')");
  });
  it('tarih geçince ayda gereken söylenmez', () => {
    expect(savingsView({ ...base, dateKey: '2026-10-01' }).needPerMonth).toBeNull();
  });
  it('acil fon ayları kurulumda saklanır, sıfırlamada silinir', () => {
    const src = read('features/modes/components/modes/TasarrufCard.tsx');
    expect(read('features/modes/utils/lifePlanStart.ts')).toContain('setCover(type');
    useBudgetStore.getState().setCover(10000, 6);
    expect(useBudgetStore.getState()).toMatchObject({ monthlyExpense: 10000, coverMonths: 6 });
    useBudgetStore.getState().reset();
    expect(useBudgetStore.getState().monthlyExpense).toBe(0);
  });
});

describe('bırakma', () => {
  it('sıradaki eşik ve aşama', () => {
    expect(quitView(10, { bestStreak: 0, relapses: [] })).toMatchObject({ prev: 7, next: 14, toNext: 4, best: 10, lapses: 0, beatBest: false });
    expect(quitView(10, { bestStreak: 0, relapses: [] }).stagePct).toBe(43);
  });
  it('en uzun seri kaymada silinmez; geçilince kutlanır', () => {
    expect(quitView(3, { bestStreak: 20, relapses: ['2026-11-01'] })).toMatchObject({ best: 20, beatBest: false, lastLapse: '2026-11-01' });
    expect(quitView(21, { bestStreak: 20, relapses: ['2026-10-01'] }).beatBest).toBe(true);
  });
  it('son eşikten sonra bitti der', () => {
    expect(quitView(400, { bestStreak: 0, relapses: [] })).toMatchObject({ next: null, toNext: 0, stagePct: 100 });
  });
});

describe('kilo hızı', () => {
  const log = (a: number, b: number) => [{ date: '2026-10-08', weight: a }, { date: TODAY, weight: b }];
  it('hedefe doğru: hız ve tarih', () => {
    const p = kiloPace(log(80, 78), 70, TODAY);
    expect(p.perWeek).toBe(-0.5);
    expect(p.towardTarget).toBe(true);
    expect(p.projected! > TODAY).toBe(true);
  });
  it('ters giderse tarih vermez', () => {
    expect(kiloPace(log(78, 80), 70, TODAY)).toMatchObject({ towardTarget: false, projected: null });
  });
  it('almada da doğru yön', () => {
    expect(kiloPace(log(60, 62), 70, TODAY).towardTarget).toBe(true);
  });
  it('az veriyle hız söylemez', () => {
    expect(kiloPace([{ date: TODAY, weight: 80 }], 70, TODAY).perWeek).toBeNull();
    expect(kiloPace([{ date: '2026-11-03', weight: 80 }, { date: TODAY, weight: 79 }], 70, TODAY).perWeek).toBeNull();
  });
});

describe('çalışma ritmi', () => {
  it('haftalar pazartesi başlar, son satır bu hafta, gelecek işaretli', () => {
    const rows = weekGrid(new Set(['2026-11-02', '2026-11-05', '2026-11-06']), 8, TODAY);
    const week = rows[7];
    expect(week.start).toBe('2026-11-02');
    expect(week.current).toBe(true);
    expect(week.count).toBe(2); // gelecekteki gün sayılmaz
    expect(week.days[4]).toMatchObject({ key: '2026-11-06', future: true, active: false });
    expect(rows).toHaveLength(8);
  });
  it('seri: bugün yapılmadıysa bozulmaz, boşlukta kopar', () => {
    expect(dayStreak(new Set(['2026-11-04', '2026-11-03']), TODAY)).toBe(2);
    expect(dayStreak(new Set(['2026-11-05', '2026-11-04']), TODAY)).toBe(2);
    expect(dayStreak(new Set(['2026-11-02']), TODAY)).toBe(0);
  });
  it('hedefi tutan hafta serisi: bu hafta bitmediyse bozulmaz', () => {
    const days = (n: number, startMon: string) => { const d = new Date(`${startMon}T12:00:00`); return Array.from({ length: n }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x.toISOString().slice(0, 10); }); };
    const active = new Set([...days(3, '2026-10-19'), ...days(3, '2026-10-26'), ...days(1, '2026-11-02')]);
    expect(weeksOnTarget(weekGrid(active, 8, TODAY), 3)).toBe(2);
  });
  it('boş tarih sayılmaz', () => {
    expect(activeKeys(['2026-11-01'], ['0001-01-01T00:00:00', null]).size).toBe(1);
  });
});

describe('Ramazan takvimi', () => {
  it('2027: 29 gün, Kadir 26. gün 5 Mart', () => {
    const cells = ramadanCells('2027-02-08', '2027-03-08', new Set(['2027-02-08']), '2027-02-10');
    expect(cells).toHaveLength(29);
    expect(cells.find(c => c.kadir)?.key).toBe('2027-03-05');
    expect(cells[0].state).toBe('done');
    expect(cells[1].state).toBe('missed');
    expect(cells[2].state).toBe('today');
    expect(cells[3].state).toBe('future');
  });
});

describe('eski kart gömülmez', () => {
  it('Planım hedef kartı çizmez; her plan kendi takibini çizer', () => {
    const plan = read('app/plan.tsx');
    expect(plan).not.toContain('<TasarrufCard');
    expect(plan).not.toContain('<BirakmaCard');
    expect(plan).toContain('<PlanTrack');
    const track = read('features/modes/components/plan/track/PlanTrack.tsx');
    for (const part of ['SavingsTrack', 'QuitTrack', 'RamadanTrack', 'KiloTrack', 'TrainTrack', 'WorkTrack']) expect(track).toContain(part);
  });
  it('eski karttaki işler kaybolmadı', () => {
    const money = read('features/modes/components/plan/track/SavingsTrack.tsx');
    for (const fn of ['adjust(', 'undoMove(', 'addEntry(', 'setTargetAmount(', "setSeasonalPref('tasarrufDate'"]) expect(money).toContain(fn);
    const quit = read('features/modes/components/plan/track/QuitTrack.tsx');
    for (const fn of ['recordRelapse(', 'removeItem(', "request('birakma')"]) expect(quit).toContain(fn);
  });
  it('her plan türünün Takip sekmesi var; yalnız konulu sınav kendi sekmelerini kullanır', () => {
    const plan = read('app/plan.tsx');
    expect(plan).toContain("['today', 'tools', 'settings']");
    expect(plan).toContain("['today', 'tools', 'road', 'settings']");
  });
});

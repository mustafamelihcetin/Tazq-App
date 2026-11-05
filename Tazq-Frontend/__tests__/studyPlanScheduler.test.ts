import {
  applyBlock, assessFit, Block, coverage, dayKeyOf, dayNum, emptyUnitState, ensureTopics, ExamUnit, extendTopic, initTopic, markTopicDone,
  PlanTopic, planAll, planDay, project, splitShares, UnitState,
} from '@/features/studyplan/utils/scheduler';

const T = (id: string, subject: string, q: number, hours: number, kind: PlanTopic['kind'] = 'beceri'): PlanTopic => ({ id, subject, q, hours, kind });
const DGS_T = [T('anlam', 'soz', 14, 16), T('paragraf', 'soz', 24, 28), T('mantik', 'soz', 12, 18), T('islem', 'say', 12, 34), T('problem', 'say', 20, 44), T('geo', 'say', 12, 36), T('veri', 'say', 6, 8)];
const KPSS_T = [
  T('paragraf', 'tr', 14, 30), T('sozcuk', 'tr', 4, 8), T('cumle', 'tr', 4, 8), T('yazim', 'tr', 3, 6, 'ezber'), T('dilbilgi', 'tr', 3, 12, 'ezber'), T('anlatim', 'tr', 2, 4),
  T('sayilar', 'mat', 4, 14), T('bolme', 'mat', 3, 10), T('rasyonel', 'mat', 5, 16), T('oran', 'mat', 4, 10), T('problem', 'mat', 9, 36), T('geo', 'mat', 3, 18), T('veri', 'mat', 2, 4),
  T('kurulus', 'tar', 8, 18, 'ezber'), T('gerileme', 'tar', 5, 16, 'ezber'), T('milli', 'tar', 5, 12, 'ezber'), T('inkilap', 'tar', 9, 18, 'ezber'),
  T('fiziki', 'cog', 6, 14, 'ezber'), T('ekon', 'cog', 12, 22, 'ezber'), T('vat', 'vat', 9, 21, 'ezber'), T('gun', 'gun', 6, 10, 'ezber'),
];
const unit = (topics: PlanTopic[], days: number, id = 'u', mockMin = 130): ExamUnit => ({ id, topics, mockMin, examDay: days });
const week = (wd: number, we: number, rest?: number) => (d: number) => { const k = ((d % 7) + 7) % 7; if (rest != null && k === rest) return 0; return k >= 5 ? we : wd; };
const start = (u: ExamUnit, level: 'yok' | 'biraz' | 'tekrar' = 'yok'): UnitState => ensureTopics(u, emptyUnitState(), () => level, 0, 0);
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

interface Result { st: UnitState; days: Record<number, Block[]>; over: number; empty: number; }
function simulate(u: ExamUnit, cap: (d: number) => number, p: number, opts: { gap?: [number, number]; seed?: number; level?: 'yok' | 'biraz' | 'tekrar' } = {}): Result {
  let st = start(u, opts.level ?? 'yok');
  const r = rng(opts.seed ?? 7);
  const days: Record<number, Block[]> = {};
  let over = 0, empty = 0;
  for (let d = 0; d < u.examDay; d++) {
    const pl = planDay(u, st, d, cap);
    days[d] = pl;
    if (pl.reduce((a, b) => a + b.min, 0) > cap(d)) over++;
    if (cap(d) > 0 && pl.length === 0) empty++;
    const missed = opts.gap && d >= opts.gap[0] && d < opts.gap[1];
    let did = false;
    for (const b of pl) if (!missed && r() < p) { did = true; st = applyBlock(u, st, b, d, d); }
    if (opts.gap && d === opts.gap[1] - 1) st = { ...st, returnLeft: 3 };
    else if (st.returnLeft > 0 && did) st = { ...st, returnLeft: st.returnLeft - 1 };
  }
  return { st, days, over, empty };
}

const SCENARIOS: [string, ExamUnit, (d: number) => number, number, { gap?: [number, number]; level?: 'yok' | 'biraz' | 'tekrar' }][] = [
  ['DGS çalışan', unit(DGS_T, 120, 'u', 135), week(60, 240), 0.7, {}],
  ['KPSS mezun, 14 gün kopuş', unit(KPSS_T, 240), week(180, 180, 6), 0.75, { gap: [90, 104] }],
  ['DGS 25 gün', unit(DGS_T, 25, 'u', 135), week(120, 120), 0.8, {}],
  ['DGS 3 gün', unit(DGS_T, 3, 'u', 135), week(120, 120), 0.9, {}],
  ['KPSS 30 dk', unit(KPSS_T, 120), week(30, 30), 0.8, {}],
  ['KPSS 30 gün kopuş', unit(KPSS_T, 150), week(120, 120), 0.9, { gap: [60, 90] }],
  ['DGS ileri', unit(DGS_T, 60, 'u', 135), week(90, 180), 0.8, { level: 'tekrar' }],
  ['DGS %40 uyum', unit(DGS_T, 120, 'u', 135), week(90, 180), 0.4, {}],
  ['KPSS 1 yıl', unit(KPSS_T, 365), week(240, 240, 6), 0.85, {}],
  ['KPSS 10 dk', unit(KPSS_T, 60), week(10, 10), 1, {}],
];

describe('planlayıcı: her senaryoda değişmez kurallar', () => {
  it.each(SCENARIOS)('%s: süre aşılmaz, plansız gün kalmaz', (_n, u, cap, p, opts) => {
    for (const seed of [3, 7, 11, 19, 23]) {
      const r = simulate(u, cap, p, { ...opts, seed });
      expect(r.over).toBe(0);
      expect(r.empty).toBe(0);
    }
  });

  it.each(SCENARIOS)('%s: sınav günü görev yok, arife en çok 30 dk', (_n, u, cap, p, opts) => {
    const r = simulate(u, cap, p, opts);
    expect(planDay(u, r.st, u.examDay, cap)).toEqual([]);
    expect(planDay(u, r.st, u.examDay + 5, cap)).toEqual([]);
    const eve = r.days[u.examDay - 1];
    if (cap(u.examDay - 1) > 0) { expect(eve).toHaveLength(1); expect(eve[0].type).toBe('hafif'); expect(eve[0].min).toBeLessThanOrEqual(30); }
  });

  it('aynı girdi aynı plan', () => {
    const u = unit(DGS_T, 120, 'u', 135);
    const a = simulate(u, week(90, 180), 0.8, { seed: 5 });
    const b = simulate(u, week(90, 180), 0.8, { seed: 5 });
    expect(a.days).toEqual(b.days);
  });

  it('plan girdi durumunu değiştirmez', () => {
    const u = unit(DGS_T, 120, 'u', 135);
    const st = start(u);
    const copy = JSON.stringify(st);
    planDay(u, st, 5, week(90, 180));
    project([u], { u: st }, 0, week(90, 180));
    expect(JSON.stringify(st)).toBe(copy);
  });
});

describe('gerçekleşen esastır', () => {
  it('hiç çalışmayanın konusu ilerlemez', () => {
    const u = unit(DGS_T, 120, 'u', 135);
    const r = simulate(u, week(90, 180), 0);
    expect(coverage(u, r.st)).toBe(0);
    expect(r.days[50]).toEqual(r.days[50].map(b => ({ ...b, type: b.type })));
    expect(r.days[50].every(b => b.type === 'yeni')).toBe(true);
  });

  it('kaçan iş günü şişirmez: kopuş dönüşünde yük hafif, tekrarlar yığılmaz', () => {
    const u = unit(KPSS_T, 150);
    const r = simulate(u, week(120, 120), 0.95, { gap: [60, 90] });
    const first = r.days[90];
    expect(first.reduce((a, b) => a + b.min, 0)).toBeLessThanOrEqual(72);
    expect(first.some(b => b.type === 'deneme')).toBe(false);
  });
});

describe('konu bitti işareti', () => {
  const u = unit(DGS_T, 200, 'u', 135);
  it('tekrar zincirini başlatır', () => {
    const st = markTopicDone(start(u), 'veri', 'orta', 10, 1);
    expect(st.topics.veri.cov).toBe(1);
    expect(st.topics.veri.due).toBe(12);
    const pl = planDay(u, st, 12, week(120, 120));
    expect(pl.some(b => b.type === 'tekrar' && b.topicId === 'veri')).toBe(true);
  });
  it('zor erken, kolay geç tekrar ister', () => {
    expect(markTopicDone(start(u), 'veri', 'zor', 10, 1).topics.veri.due).toBe(11);
    expect(markTopicDone(start(u), 'veri', 'kolay', 10, 1).topics.veri.due).toBe(17);
  });
  it('biten konuya yeni blok gelmez; "biraz daha" geri getirir', () => {
    const st = markTopicDone(start(u), 'veri', 'orta', 10, 1);
    expect(planDay(u, st, 11, week(600, 600)).some(b => b.type === 'yeni' && b.topicId === 'veri')).toBe(false);
    const more = extendTopic(st, 'veri', 2);
    expect(more.topics.veri.cov).toBeCloseTo(0.8);
    expect(more.topics.veri.due).toBeNull();
  });
  it('kısa kalıntı planı kilitlemez (simülasyonda bulunan hata)', () => {
    let st = start(u);
    st = { ...st, topics: { ...st.topics, veri: { ...st.topics.veri, cov: 1 - 5 / (8 * 60) } } };
    const pl = planDay(u, st, 5, week(120, 120));
    expect(pl.reduce((a, b) => a + b.min, 0)).toBeGreaterThan(100);
  });
});

describe('takvim okunur olmalı', () => {
  const maxStreak = (r: Result, u: ExamUnit) => {
    let worst = 0;
    let run: Record<string, number> = {};
    let st = start(u);
    for (let d = 0; d < u.examDay; d++) {
      const today = (r.days[d] ?? []).filter(b => b.type === 'yeni').map(b => b.topicId as string);
      const open = u.topics.filter(t => (st.topics[t.id]?.cov ?? 0) < 0.999);
      const next: Record<string, number> = {};
      for (const id of today) { next[id] = (run[id] ?? 0) + 1; if (open.length > 1 && next[id] > worst) worst = next[id]; }
      run = next;
      for (const b of r.days[d] ?? []) st = applyBlock(u, st, b, d, d);
    }
    return worst;
  };
  it.each([
    ['DGS çalışan', unit(DGS_T, 120, 'u', 135), week(60, 240)],
    ['DGS orta', unit(DGS_T, 120, 'u', 135), week(90, 180)],
    ['KPSS mezun', unit(KPSS_T, 240), week(180, 180)],
    ['KPSS 30 dk', unit(KPSS_T, 120), week(30, 30)],
  ] as const)('%s: başka açık konu varken aynı konu üst üste en çok 3 gün', (_n, u, cap) => {
    expect(maxStreak(simulate(u, cap, 1), u)).toBeLessThanOrEqual(3);
  });

  it('ders payına uyar: KPSS Tarih, Vatandaşlıktan çok çalışılır', () => {
    const u = unit(KPSS_T, 120);
    const st = simulate(u, week(90, 90), 1).st;
    expect(st.subMin.tar).toBeGreaterThan(st.subMin.vat ?? 0);
  });
});

describe('deneme ve son tur', () => {
  it('hazırlık yokken deneme verilmez', () => {
    const u = unit(DGS_T, 25, 'u', 135);
    expect(simulate(u, week(120, 120), 0).days[10].some(b => b.type === 'deneme')).toBe(false);
  });
  it('tam deneme sığmıyorsa bölüm denemesi, sığıyorsa en uzun güne', () => {
    const short = unit(DGS_T, 60, 'u', 135);
    const s = simulate(short, week(45, 45), 1, { level: 'tekrar' });
    const mock = Object.values(s.days).flat().find(b => b.type === 'deneme');
    expect(mock?.min).toBeLessThanOrEqual(45);
    const long = simulate(unit(DGS_T, 120, 'u', 135), week(60, 240), 1);
    const days = Object.entries(long.days).filter(([, b]) => b.some(x => x.type === 'deneme')).map(([d]) => Number(d) % 7);
    expect(days.length).toBeGreaterThan(0);
    expect(days.every(k => k >= 5)).toBe(true);
  });
  it('hazırlıklı kullanıcıya son günlerde yeni konu yok', () => {
    const u = unit(DGS_T, 120, 'u', 135);
    const r = simulate(u, week(240, 240), 1);
    for (let d = 117; d < 120; d++) expect(r.days[d].some(b => b.type === 'yeni')).toBe(false);
  });
  it('hiç hazırlığı olmayana 3 gün kala boş plan değil, en değerli konu', () => {
    const u = unit(DGS_T, 3, 'u', 135);
    const pl = planDay(u, start(u), 0, week(120, 120));
    expect(pl.length).toBeGreaterThan(0);
    expect(pl[0].type).toBe('yeni');
    expect(['paragraf', 'anlam', 'veri', 'mantik']).toContain(pl[0].topicId);
  });
  it('denemeden gelen pratik öne alınır', () => {
    const u = unit(DGS_T, 100, 'u', 135);
    const st = { ...start(u), practice: ['geo'] };
    const pl = planDay(u, st, 0, week(120, 120));
    expect(pl[0]).toMatchObject({ type: 'pratik', topicId: 'geo' });
    expect(applyBlock(u, st, pl[0], 0, 0).practice).toEqual([]);
  });
  it('denemede geride kalan ders daha çok alır', () => {
    const u = unit(DGS_T, 100, 'u', 135);
    const base = simulate(u, week(120, 120), 1);
    let st: UnitState = { ...start(u), boost: { say: 3 } };
    for (let d = 0; d < 40; d++) for (const b of planDay(u, st, d, week(120, 120))) st = applyBlock(u, st, b, d, d);
    let plain = start(u);
    for (let d = 0; d < 40; d++) for (const b of planDay(u, plain, d, week(120, 120))) plain = applyBlock(u, plain, b, d, d);
    expect(st.subMin.say).toBeGreaterThan(plain.subMin.say);
    expect(base.over).toBe(0);
  });
});

describe('sığma', () => {
  it('rahat, sıkışık, sığmıyor ayrımı', () => {
    const u = unit(DGS_T, 300, 'u', 135);
    expect(assessFit(u, start(u), 0, week(240, 240), 0.8).status).toBe('fits');
    const late = unit(DGS_T, 25, 'u', 135);
    const r = assessFit(late, start(late), 0, week(60, 60), 0.8);
    expect(r.status).toBe('over');
    expect(r.out.length).toBeGreaterThan(0);
  });
  it('dışarıda kalan, az soru getiren konudur', () => {
    const late = unit(DGS_T, 25, 'u', 135);
    const r = assessFit(late, start(late), 0, week(120, 120), 0.8);
    expect(r.out).not.toContain('paragraf');
  });
  it('süre artınca dışarıda kalan azalır', () => {
    const late = unit(KPSS_T, 60);
    const low = assessFit(late, start(late), 0, week(60, 60), 0.8).out.length;
    const high = assessFit(late, start(late), 0, week(240, 240), 0.8).out.length;
    expect(high).toBeLessThan(low);
  });
});

describe('birden çok sınav', () => {
  const a = unit(DGS_T, 60, 'dgs', 135);
  const b = unit(KPSS_T, 300, 'kpss');
  const states = { dgs: start(a), kpss: start(b) };
  it('yakın sınav daha çok alır, uzak sıfırlanmaz', () => {
    const s = splitShares([a, b], states, 0);
    expect(s.dgs).toBeGreaterThan(s.kpss);
    expect(s.kpss).toBeGreaterThanOrEqual(0.15);
    expect(s.dgs + s.kpss).toBeCloseTo(1);
  });
  it('toplam süre aşılmaz', () => {
    for (let d = 0; d < 60; d++) expect(planAll([a, b], states, d, week(120, 180)).reduce((x, y) => x + y.min, 0)).toBeLessThanOrEqual(week(120, 180)(d));
  });
  it('sınav bitince pay diğerine geçer', () => {
    const s = splitShares([a, b], states, 61);
    expect(s.kpss).toBe(1);
    expect(s.dgs).toBe(0);
  });
  it('final dönemi: 6 ders yetişir ve hepsi süre alır', () => {
    const courses = [10, 12, 14, 16, 18, 20].map((day, i) => unit([T(`c${i}a`, `c${i}`, 5, 8), T(`c${i}b`, `c${i}`, 5, 8)], day, `c${i}`, 60));
    const st: Record<string, UnitState> = {};
    for (const c of courses) st[c.id] = start(c);
    const pl = planAll(courses, st, 0, week(240, 240));
    expect(new Set(pl.map(x => x.unitId)).size).toBeGreaterThanOrEqual(4);
    expect(pl.reduce((x, y) => x + y.min, 0)).toBeLessThanOrEqual(240);
  });
});

describe('takvim çizimi', () => {
  const u = unit(DGS_T, 100, 'u', 135);
  it('sabit günler değişmez', () => {
    const fixed = { 3: [{ type: 'yeni' as const, unitId: 'u', topicId: 'geo', subject: 'say', min: 30 }] };
    expect(project([u], { u: start(u) }, 0, week(120, 120), fixed).days[3]).toEqual(fixed[3]);
  });
  it('son tur gününü ve bitiş gününü verir', () => {
    const p = project([u], { u: start(u) }, 0, week(300, 300));
    expect(p.lastRoundStart.u).toBeLessThan(100);
    expect(p.finishDay.u).not.toBeNull();
    expect(p.finishDay.u as number).toBeLessThan(100);
  });
  it('bir yıllık çizim hızlı', () => {
    const big = unit(KPSS_T, 365);
    const t0 = Date.now();
    project([big], { u: start(big) }, 0, week(240, 240));
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe('gün numarası', () => {
  it('yaz saatinden ve saat diliminden bağımsız', () => {
    expect(dayNum('2027-03-29') - dayNum('2027-03-27')).toBe(2);
    expect(dayKeyOf(dayNum('2027-10-31'))).toBe('2027-10-31');
  });
  it('başlangıç seviyesi kapsama çevrilir', () => {
    const t = T('a', 's', 1, 10);
    expect(initTopic(t, 'yok', 0, 0).cov).toBe(0);
    expect(initTopic(t, 'tekrar', 0, 0).cov).toBe(0.75);
    expect(initTopic(t, 'tekrar', 0, 40).due).toBe(40);
  });
});

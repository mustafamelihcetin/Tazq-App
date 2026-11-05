import { blueprintFor, presetFor } from '@/features/studyplan/data/blueprints';
import { blockTag, confirmMissed, emptyCore, mergeCloud, parseBlockTag, planHasContent, reconcileTasks, setBlockDone, skipBlock, SlotInput, StudyCore, syncCore, toCloud, unitsOfPlan, viewOf, effectiveStates, capOf } from '@/features/studyplan/utils/planCore';
import { blockTitle, blocksToTasks, orphanTodayTaskIds, staleStudyTaskIds } from '@/features/studyplan/utils/planBridge';
import { applyMock, boostsFrom, mockTotal, netOf, sectionRatio, validScore, MockRecord } from '@/features/studyplan/utils/mockScore';
import { dayKeyOf, dayNum, emptyUnitState } from '@/features/studyplan/utils/scheduler';
import { EXAM_PRESETS } from '@/shared/utils/examPresets';
import { BASELINE_CURRICULUM, findExamCurriculum } from '@/shared/utils/curriculum';

const TODAY = '2027-01-04';
const next = (k: string, n = 1) => dayKeyOf(dayNum(k) + n);
const DGS: SlotInput = { slot: 'exam', name: 'DGS', date: '2027-07-18', dailyMinutes: 90 };
const start = (slots: SlotInput[] = [DGS]) => syncCore(emptyCore(), slots, TODAY, 1000);

describe('sınav haritası', () => {
  it('her konu listesi planlanabilir: ağırlık ve saat pozitif', () => {
    for (const ex of BASELINE_CURRICULUM.exams) {
      const preset = EXAM_PRESETS.find(p => p.id === ex.id);
      expect(preset).toBeDefined();
      const bp = blueprintFor(preset!.displayName);
      expect(bp?.examId).toBe(ex.id);
      for (const t of bp!.topics) { expect(t.q).toBeGreaterThan(0); expect(t.hours).toBeGreaterThan(0); }
    }
  });
  it('KPSS ağırlıkları gerçek dağılımı izler; ÖSYM süresi', () => {
    const bp = blueprintFor('KPSS')!;
    const sum = (s: string) => bp.topics.filter(t => t.subject === s).reduce((a, t) => a + t.q, 0);
    expect(sum('kpss_tarih')).toBeGreaterThan(sum('kpss_vatandaslik') * 2);
    expect(bp.mockMin).toBe(130);
  });
  it('EN sınavları: SAT, IELTS derin; her birinin puan modeli doğru', () => {
    expect(blueprintFor('SAT')?.score).toEqual({ kind: 'scaled', min: 400, max: 1600 });
    expect(blueprintFor('IELTS')?.score.kind).toBe('band');
    expect(blueprintFor('IELTS')?.topics[0].kind).toBe('dil');
    expect(blueprintFor('DGS')?.score).toEqual({ kind: 'net', penalty: 0.25 });
    expect(blueprintFor('PMP')?.score.kind).toBe('percent');
  });
  it('konu listesi olmayan EN sınavları tanınır ama kullanıcı konu girer', () => {
    for (const n of ['CFA', 'AP', 'A-Level', 'GCSE', 'JLPT', 'Final', 'Vize']) {
      expect(presetFor(n)).not.toBeNull();
      expect(blueprintFor(n)).toBeNull();
    }
  });
  it('kısa ve alakasız girdi başka sınava bağlanmaz', () => {
    expect(findExamCurriculum('at')).toBeNull();
    expect(findExamCurriculum('Satış sınavı')).toBeNull();
    expect(findExamCurriculum('Matematik finali')).toBeNull();
    expect(findExamCurriculum('kps')?.id).toBe('kpss');
  });
});

describe('plan oluşumu', () => {
  it('slot plana dönüşür, süre seçimi miras alınır, 7 gün sabitlenir', () => {
    const c = start();
    expect(c.plans.dgs.slot).toBe('exam');
    expect(c.week).toEqual([90, 90, 90, 90, 90, 90, 90]);
    for (let i = 0; i < 7; i++) expect(c.committed[next(TODAY, i)]).toBeDefined();
  });
  it('konusu olmayan sınavda takvim yok, eski motor devam eder', () => {
    const c = syncCore(emptyCore(), [{ slot: 'exam', name: 'Ehliyet', date: '2027-03-01', dailyMinutes: 60 }], TODAY, 1);
    expect(Object.values(c.plans)[0].key).toMatch(/^custom_/);
    expect(planHasContent(Object.values(c.plans)[0])).toBe(false);
    expect(Object.keys(c.committed)).toHaveLength(0);
  });
  it('dersleri girince her ders kendi tarihine yetişir', () => {
    const c0 = syncCore(emptyCore(), [{ slot: 'exam', name: 'Finaller', date: '2027-01-25', dailyMinutes: 120 }], TODAY, 1);
    const key = Object.keys(c0.plans)[0];
    const courses = [
      { id: 'a', name: 'Fizik', date: '2027-01-12', topics: [{ id: 'f1', name: 'Kuvvet' }, { id: 'f2', name: 'Enerji' }] },
      { id: 'b', name: 'Kimya', date: '2027-01-20', topics: [{ id: 'k1', name: 'Mol' }] },
    ];
    const c1: StudyCore = { ...c0, plans: { ...c0.plans, [key]: { ...c0.plans[key], courses } } };
    const c2 = syncCore(c1, [{ slot: 'exam', name: 'Finaller', date: '2027-01-25', dailyMinutes: 120 }], TODAY, 2, { replan: true });
    expect(unitsOfPlan(c2.plans[key])).toHaveLength(2);
    expect(c2.committed[TODAY].length).toBeGreaterThan(0);
    expect(blockTitle(c2.committed[TODAY][0], c2.plans[key], 'tr')).toMatch(/Fizik|Kimya/);
  });
  it('sınav kapanınca ilerleme saklanır, yeniden kurulunca döner', () => {
    let c = start();
    c = { ...c, plans: { ...c.plans, dgs: { ...c.plans.dgs, states: { dgs: { ...emptyUnitState(), subMin: { dgs_sozel: 300 } } } } } };
    c = syncCore(c, [], TODAY, 2);
    expect(c.plans.dgs.slot).toBeNull();
    expect(c.committed[next(TODAY)]).toBeUndefined();
    c = syncCore(c, [DGS], TODAY, 3);
    expect(c.plans.dgs.states.dgs.subMin.dgs_sozel).toBe(300);
    expect(c.plans.dgs.slot).toBe('exam');
  });
});

describe('gerçekleşen esastır', () => {
  it('yapılmayan gün konuyu ilerletmez, ertesi gün yük artmaz', () => {
    const c = start();
    const tomorrow = syncCore(c, [DGS], next(TODAY), 2);
    const covered = Object.values(tomorrow.plans.dgs.states.dgs?.topics ?? {}).filter(t => t.cov > 0).length;
    expect(covered).toBe(0);
    const load = tomorrow.committed[next(TODAY)].reduce((a, b) => a + b.min, 0);
    expect(load).toBeLessThanOrEqual(90);
    expect(tomorrow.missed.length).toBeGreaterThan(0);
  });
  it('yapılan gün konuya yazılır; aynı gün geri alınan yazılmaz', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    const done = setBlockDone(c, TODAY, b.id, true);
    expect(syncCore(done, [DGS], next(TODAY), 2).plans.dgs.states.dgs.topics[b.topicId as string].cov).toBeGreaterThan(0);
    const undone = setBlockDone(done, TODAY, b.id, false);
    const after = syncCore(undone, [DGS], next(TODAY), 2);
    expect(after.plans.dgs.states.dgs?.topics?.[b.topicId as string]?.cov ?? 0).toBe(0);
  });
  it('tamamlanan görev bloğu işaretler, geri alınan kaldırır', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    const on = reconcileTasks(c, [{ tags: ['exam', b.id], isCompleted: true }], TODAY);
    expect(on.committed[TODAY][0].done).toBe(true);
    const off = reconcileTasks(on, [{ tags: ['exam', b.id], isCompleted: false }], TODAY);
    expect(off.committed[TODAY][0].done).toBe(false);
    expect(reconcileTasks(off, [{ tags: ['exam', b.id], isCompleted: false }], TODAY)).toBe(off);
  });
  it('başka cihazın açtığı görev tanınır', () => {
    const c = start();
    const tag = blockTag(TODAY, { type: 'yeni', topicId: 'dgs_sayisal_geometri', unitId: 'dgs', min: 37 });
    const r = reconcileTasks(c, [{ tags: [tag], isCompleted: true }], TODAY);
    expect(r.committed[TODAY].find(b => b.id === tag)?.done).toBe(true);
  });
  it('plan değişmeden önce açılmış eski görev ikinci blok olmaz', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    const old = blockTag(TODAY, { type: b.type, topicId: b.topicId, unitId: b.unitId, min: b.min + 7 });
    const r = reconcileTasks(c, [{ tags: [old] }], TODAY);
    expect(r.committed[TODAY]).toHaveLength(c.committed[TODAY].length);
    expect(orphanTodayTaskIds([{ id: 1, tags: [old] }], r.committed[TODAY], TODAY)).toEqual([1]);
  });
  it('"bugün olmaz" kaçırılmış sayılmaz ve uyumu bozmaz', () => {
    const c = start();
    const skipped = c.committed[TODAY].reduce((acc, b) => skipBlock(acc, TODAY, b.id), c);
    const t = syncCore(skipped, [DGS], next(TODAY), 2);
    expect(t.missed).toHaveLength(0);
    expect(t.dayStats[TODAY]).toBeUndefined();
  });
});

describe('takvim sabitliği', () => {
  it('ertesi gün sabit günler aynı kalır', () => {
    const c = start();
    const d3 = c.committed[next(TODAY, 3)];
    expect(syncCore(c, [DGS], next(TODAY), 2).committed[next(TODAY, 3)]).toEqual(d3);
  });
  it('tarih değişince gelecek yenilenir, haber verilir; bugünün yapılmışı durur', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    const done = setBlockDone(c, TODAY, b.id, true);
    const moved = syncCore(done, [{ ...DGS, date: '2027-02-01' }], TODAY, 2);
    expect(moved.notice).toEqual({ type: 'date', planKey: 'dgs' });
    expect(moved.committed[TODAY].find(x => x.id === b.id)?.done).toBe(true);
  });
  it('duraklatılan sınav plan almaz, devamda geri gelir', () => {
    const paused = syncCore(start(), [{ ...DGS, paused: true }], TODAY, 2);
    expect(paused.committed[next(TODAY)]).toBeUndefined();
    const back = syncCore(paused, [DGS], TODAY, 3);
    expect(back.committed[next(TODAY)]?.length).toBeGreaterThan(0);
  });
  it('kapalı gün boş kalır', () => {
    const c = start();
    const closed = syncCore({ ...c, closed: [next(TODAY, 8)] }, [DGS], next(TODAY, 2), 2);
    expect(capOf(closed)(dayNum(next(TODAY, 8)))).toBe(0);
    const later = syncCore(closed, [DGS], next(TODAY, 8), 3);
    expect(later.committed[next(TODAY, 8)]).toEqual([]);
  });
});

describe('sonradan eklenen sınav', () => {
  it('aynı gün plan alır; yapılmış iş durur, süre aşılmaz', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    const done = setBlockDone(c, TODAY, b.id, true);
    const both = syncCore(done, [DGS, { slot: 'exam2', name: 'IELTS', date: '2027-03-01', dailyMinutes: 45 }], TODAY, 2);
    const blocks = both.committed[TODAY];
    expect(blocks.some(x => x.planKey === 'ielts')).toBe(true);
    expect(blocks.find(x => x.id === b.id)?.done).toBe(true);
    expect(both.week?.[1]).toBe(135);
    expect(blocks.filter(x => !x.done).reduce((a, x) => a + x.min, 0)).toBeLessThanOrEqual(135);
  });
});

describe('kopuş ve işaretsiz kullanım', () => {
  const activeThen = (gap: number) => {
    let c = start();
    c = setBlockDone(c, TODAY, c.committed[TODAY][0].id, true);
    let day = TODAY;
    for (let i = 1; i <= gap + 1; i++) { day = next(TODAY, i); c = syncCore(c, [DGS], day, i + 1); }
    return { c, day };
  };
  it('kısa ara haber vermez', () => {
    expect(activeThen(2).c.notice).toBeNull();
  });
  it('uzun aradan dönüşte hafif başlar ve suçlamaz', () => {
    const { c, day } = activeThen(5);
    expect(c.notice?.type).toBe('return');
    const load = c.committed[day].reduce((a, b) => a + b.min, 0);
    expect(load).toBeLessThanOrEqual(54);
    expect(c.committed[day].some(b => b.type === 'deneme')).toBe(false);
  });
  it('hiç işaretlemeyene sorulur, sessizce ilerlemez', () => {
    let c = start();
    let day = TODAY;
    for (let i = 1; i <= 4; i++) { day = next(TODAY, i); c = syncCore(c, [DGS], day, i + 1); }
    expect(c.notice?.type).toBe('unmarked');
    const yes = confirmMissed(c, day, 99);
    expect(yes.notice).toBeNull();
    expect(yes.missed).toHaveLength(0);
    expect(Object.values(yes.plans.dgs.states.dgs.topics).some(t => t.cov > 0)).toBe(true);
    expect(yes.lastActive).not.toBeNull();
  });
});

describe('görev köprüsü', () => {
  it('başlık somut: sınav · konu · süre; iki dilde', () => {
    const c = start();
    const b = { ...c.committed[TODAY][0], type: 'yeni' as const, topicId: 'dgs_sayisal_problem', min: 40 };
    expect(blockTitle(b, c.plans.dgs, 'tr')).toBe('DGS · Problemler çalış · 40 dk');
    expect(blockTitle(b, c.plans.dgs, 'en')).toBe('DGS · Word Problems study · 40 min');
    expect(blockTitle({ ...b, type: 'deneme', topicId: undefined, min: 135 }, c.plans.dgs, 'tr')).toBe('DGS · deneme · 135 dk');
  });
  it('bütçe kadar görev iner; etiket bloğun kimliği', () => {
    const c = start();
    const tasks = blocksToTasks(c.committed[TODAY], c, TODAY, 'exam', 1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].tags).toEqual(expect.arrayContaining(['exam', 'daily', c.committed[TODAY][0].id]));
    expect(parseBlockTag(c.committed[TODAY][0].id)?.day).toBe(TODAY);
  });
  it('etiket görünmez: iç etiket biçiminde', () => {
    const { isInternalTag } = require('@/features/tasks/utils/taskTags');
    expect(isInternalTag(start().committed[TODAY][0].id)).toBe(true);
  });
  it('dünden kalan bitmemiş görev kaldırılır, yapılmış kalır', () => {
    const y = blockTag('2027-01-03', { type: 'yeni', topicId: 'a', unitId: 'u', min: 20 });
    const t = blockTag(TODAY, { type: 'yeni', topicId: 'a', unitId: 'u', min: 20 });
    expect(staleStudyTaskIds([{ id: 1, tags: [y] }, { id: 2, tags: [y], isCompleted: true }, { id: 3, tags: [t] }, { id: 4, tags: ['work'] }], TODAY)).toEqual([1]);
  });
  it('plan değişince bugünün planda olmayan görevi kalkar', () => {
    const c = start();
    const live = c.committed[TODAY][0].id;
    const old = blockTag(TODAY, { type: 'yeni', topicId: 'eski', unitId: 'dgs', min: 20 });
    expect(orphanTodayTaskIds([{ id: 1, tags: [live] }, { id: 2, tags: [old] }, { id: 3, tags: [old], isCompleted: true }], c.committed[TODAY], TODAY)).toEqual([2]);
  });
});

describe('sığma görünümü', () => {
  it('rahat sınav "sığıyor", dar sınav sebebini söyler', () => {
    const wide = viewOf(syncCore(emptyCore(), [{ ...DGS, date: '2028-01-01', dailyMinutes: 180 }], TODAY, 1), TODAY);
    expect(wide.fit).toBe('fits');
    const narrow = viewOf(syncCore(emptyCore(), [{ ...DGS, date: '2027-01-20', dailyMinutes: 60 }], TODAY, 1), TODAY);
    expect(narrow.fit).toBe('over');
    expect(narrow.outTopics.length).toBeGreaterThan(0);
  });
  it('yapılan iş kapsamı artırır', () => {
    const c = start();
    const b = c.committed[TODAY][0];
    expect(effectiveStates(setBlockDone(c, TODAY, b.id, true), TODAY).states.dgs.topics[b.topicId as string].cov).toBeGreaterThan(0);
  });
});

describe('deneme kaydı', () => {
  const NET = { kind: 'net' as const, penalty: 0.25 };
  const rec = (sections: MockRecord['sections'], extra: Partial<MockRecord> = {}): MockRecord => ({ id: 'm', day: TODAY, unitId: 'dgs', sections, ...extra });
  it('net: 4 yanlış 1 doğru; LGS 3 yanlış 1 doğru', () => {
    expect(netOf(40, 8, 0.25)).toBe(38);
    expect(netOf(30, 6, 1 / 3)).toBe(28);
    expect(mockTotal(rec({ a: { correct: 40, wrong: 8 }, b: { correct: 20, wrong: 4 } }), NET)).toBe(57);
  });
  it('tüm puan modelleri tek ölçeğe iner', () => {
    expect(sectionRatio({ score: 1000 }, { kind: 'scaled', min: 400, max: 1600 })).toBeCloseTo(0.5);
    expect(sectionRatio({ score: 6.5 }, { kind: 'band', min: 0, max: 9, step: 0.5 })).toBeCloseTo(6.5 / 9);
    expect(sectionRatio({ score: 70 }, { kind: 'percent' })).toBeCloseTo(0.7);
    expect(sectionRatio({}, { kind: 'percent' })).toBeNull();
  });
  it('geçersiz puan reddedilir', () => {
    expect(validScore(1700, { kind: 'scaled', min: 400, max: 1600 })).toBe(false);
    expect(validScore(120, { kind: 'percent' })).toBe(false);
    expect(validScore(7, { kind: 'band', min: 0, max: 9, step: 0.5 })).toBe(true);
    expect(validScore(NaN, NET)).toBe(false);
  });
  it('geride kalan ders daha çok alır; tek bölümde karşılaştırma yapılmaz', () => {
    const b = boostsFrom(rec({ a: { correct: 45, wrong: 5 }, b: { correct: 15, wrong: 35 } }), NET);
    expect(b.b).toBeGreaterThan(1);
    expect(b.a).toBeUndefined();
    expect(boostsFrom(rec({ a: { correct: 10, wrong: 5 } }), NET)).toEqual({});
  });
  it('yanlış nedeni doğru eyleme döner', () => {
    const base = { ...emptyUnitState(), topics: { x: { cov: 1, S: 5, lastTouch: 1, step: 2, due: 50, at: 0 }, y: { cov: 1, S: 5, lastTouch: 1, step: 2, due: 50, at: 0 }, z: { cov: 1, S: 5, lastTouch: 1, step: 2, due: 50, at: 0 } } };
    const r = applyMock(base, rec({}, { misses: [{ topicId: 'x', reason: 'bilmiyordum' }, { topicId: 'y', reason: 'unuttum' }, { topicId: 'z', reason: 'sure' }] }), NET, 10, 5);
    expect(r.topics.x.cov).toBe(0.7);
    expect(r.topics.x.weak).toBe(true);
    expect(r.topics.y.due).toBe(10);
    expect(r.practice).toEqual(['z']);
    expect(r.lastMock).toBe(10);
  });
});

describe('bulut', () => {
  it('boş bulut dolu yereli silmez', () => {
    const c = start();
    expect(mergeCloud(c, null)).toBe(c);
    expect(mergeCloud(c, { week: null, weekAt: 0, closed: [], lastActive: null, plans: {} }).plans.dgs).toBeDefined();
  });
  it('yeni cihaz bulutu alır, slot cihazda bağlanır', () => {
    const c = setBlockDone(start(), TODAY, start().committed[TODAY][0].id, true);
    const settled = syncCore(c, [DGS], next(TODAY), 5);
    const fresh = mergeCloud(emptyCore(), toCloud(settled));
    expect(fresh.plans.dgs.slot).toBeNull();
    const synced = syncCore(fresh, [DGS], next(TODAY), 6);
    expect(synced.plans.dgs.slot).toBe('exam');
    expect(Object.values(synced.plans.dgs.states.dgs.topics).some(t => t.cov > 0)).toBe(true);
  });
  it('konu başına son yazan kazanır, denemeler birleşir', () => {
    const topic = (cov: number, at: number) => ({ cov, S: 5, lastTouch: 1, step: 0, due: null, at });
    const local = start();
    const l = { ...local, plans: { ...local.plans, dgs: { ...local.plans.dgs, mocks: [{ id: 'a', day: TODAY, unitId: 'dgs', sections: {} }], states: { dgs: { ...emptyUnitState(), topics: { x: topic(0.5, 10), y: topic(0.9, 30) } } } } } };
    const cloud = toCloud(l);
    cloud.plans.dgs.mocks = [{ id: 'b', day: TODAY, unitId: 'dgs', sections: {} }];
    cloud.plans.dgs.states.dgs.topics = { x: topic(0.8, 20), y: topic(0.1, 5) };
    const m = mergeCloud(l, cloud).plans.dgs;
    expect(m.states.dgs.topics.x.cov).toBe(0.8);
    expect(m.states.dgs.topics.y.cov).toBe(0.9);
    expect(m.mocks.map(x => x.id).sort()).toEqual(['a', 'b']);
  });
  it('bulut kopyası küçük kalır: 3 sınav + 40 deneme 60 KB altında', () => {
    let c = syncCore(emptyCore(), [DGS, { slot: 'exam2', name: 'KPSS', date: '2027-09-12' }, { slot: 'exam3', name: 'YKS', date: '2027-06-19' }], TODAY, 1);
    for (const p of Object.values(c.plans)) {
      const unit = unitsOfPlan(p)[0];
      const topics: Record<string, { cov: number; S: number; lastTouch: number; step: number; due: number; at: number }> = {};
      for (const t of unit.topics) topics[t.id] = { cov: 0.53, S: 12.4, lastTouch: 20000, step: 2, due: 20010, at: 1800000000000 };
      c = { ...c, plans: { ...c.plans, [p.key]: { ...p, states: { [unit.id]: { ...emptyUnitState(), topics } }, mocks: Array.from({ length: 60 }, (_, i): MockRecord => ({ id: `m${i}`, day: TODAY, unitId: unit.id, sections: Object.fromEntries(unit.topics.slice(0, 6).map(t => [t.subject, { correct: 20, wrong: 5 }])) })) } } };
    }
    expect(JSON.stringify(toCloud(c)).length).toBeLessThan(60000);
  });
});

import { emptyCore, mergeOpenBlocks, setBlockDone, skipBlock, syncCore, viewOf, confirmMissed, SlotInput, StudyCore } from '@/features/studyplan/utils/planCore';
import { dayKeyOf, dayNum } from '@/features/studyplan/utils/scheduler';
import { overdueAction } from '@/features/modes/utils/goalRows';

/*
  "MEKANİZMA İŞLİYOR MU" SİMÜLASYONU (2026-11-05). Tek tek kurallar studyPlanCore'da; burası uzun dönemi sınar: yapan, geri alan, "bugün olmaz" diyen,
  boş geçen ve bir hafta kaybolan kullanıcıyla her gün aynı değişmezler tutuyor mu.
*/
const START = '2027-01-04';
const coin = (i: number) => { const x = Math.sin(i * 78.233) * 43758.5453; return x - Math.floor(x); };
const key = (n: number) => dayKeyOf(dayNum(START) + n);
const CAP = 90;

type Act = 'done' | 'skip' | 'none';
function run(slots: SlotInput[], days: number, behave: (d: number, i: number) => Act) {
  let c: StudyCore = syncCore(emptyCore(), slots, START, 1);
  const log: { day: string; before: string[]; acted: { id: string; act: Act }[] }[] = [];
  let i = 0;
  const frozen = new Map<string, boolean>();
  for (let d = 0; d < days; d++) {
    const today = key(d);
    if (d > 0) c = syncCore(c, slots, today, d + 1);
    const blocks = c.committed[today] ?? [];
    // Yapılmış iş sonradan hiçbir eşitlemede silinmez ya da geri alınmaz.
    for (const [id, was] of frozen) if (id.includes(today.replace(/-/g, '')) && was) expect(blocks.find(b => b.id === id)?.done).toBe(true);
    const acted: { id: string; act: Act }[] = [];
    for (const b of blocks) {
      const act = behave(d, ++i);
      acted.push({ id: b.id, act });
      if (act === 'done') { c = setBlockDone(c, today, b.id, true); frozen.set(b.id, true); }
      if (act === 'skip') c = skipBlock(c, today, b.id);
    }
    log.push({ day: today, before: blocks.map(b => b.id), acted });
  }
  return { core: c, log };
}

const DGS: SlotInput = { slot: 'exam', name: 'DGS', date: key(120), dailyMinutes: CAP };
const covered = (c: StudyCore, plan = 'dgs') => Object.values(c.plans[plan].states[plan]?.topics ?? {}).filter(t => t.cov > 0).length;
const loadOf = (c: StudyCore, day: string) => (c.committed[day] ?? []).filter(b => !b.skipped).reduce((a, b) => a + b.min, 0);

describe('günlük hareket', () => {
  it('yapılan iş konuyu ilerletir ve sonraki günlerde kaybolmaz', () => {
    const { core } = run([DGS], 30, () => 'done');
    expect(covered(core)).toBeGreaterThan(0);
    expect(viewOf(core, key(29)).coverage).toBeGreaterThan(0);
  });
  it('hiç yapılmayan günler konuyu ilerletmez; sistem sorar, uydurmaz', () => {
    const { core } = run([DGS], 6, () => 'none');
    expect(covered(core)).toBe(0);
    expect(core.notice?.type).toBe('unmarked');
    expect(confirmMissed(core, key(5), 99).notice).toBeNull();
  });
  it('bir hafta kaybolan kullanıcıya dönüşte hafif başlangıç verilir, ceza yığılmaz', () => {
    const { core } = run([DGS], 14, d => (d >= 5 && d < 12 ? 'none' : 'done'));
    expect(loadOf(core, key(13))).toBeLessThanOrEqual(CAP);
    const atReturn = run([DGS], 13, d => (d >= 5 && d < 12 ? 'none' : 'done')).core;
    expect(atReturn.notice?.type === 'return' || atReturn.notice === null).toBe(true);
  });
  it('"bugün olmaz" kaçırma sayılmaz; o konu sonraki günlere kalır', () => {
    const { core, log } = run([DGS], 5, d => (d === 1 ? 'skip' : 'done'));
    expect(core.missed.filter(m => m.day === key(1))).toHaveLength(0);
    expect(core.dayStats[key(1)]).toBeUndefined();
    expect(log[1].acted.length).toBeGreaterThan(0);
  });
});

describe('uzun dönem değişmezler', () => {
  const mixed = (_: number, i: number): Act => { const r = coin(i); return r < 0.6 ? 'done' : r < 0.75 ? 'skip' : 'none'; };

  it('karışık kullanıcıda 90 gün: gün yükü sınırı aşmaz, kopuk blok oluşmaz', () => {
    const slots = [DGS];
    let c: StudyCore = syncCore(emptyCore(), slots, START, 1);
    let i = 0;
    for (let d = 0; d < 90; d++) {
      const today = key(d);
      if (d > 0) c = syncCore(c, slots, today, d + 1);
      expect(loadOf(c, today)).toBeLessThanOrEqual(CAP);
      const ids = (c.committed[today] ?? []).map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const b of c.committed[today] ?? []) {
        const act = mixed(d, ++i);
        if (act === 'done') c = setBlockDone(c, today, b.id, true);
        if (act === 'skip') c = skipBlock(c, today, b.id);
      }
    }
    expect(viewOf(c, key(89)).coverage).toBeGreaterThan(0);
  });
  it('düzenli çalışan, plansız çalışandan belirgin önde', () => {
    const steady = run([DGS], 60, () => 'done').core;
    const sloppy = run([DGS], 60, (_, i) => (coin(i) < 0.25 ? 'done' : 'none')).core;
    expect(viewOf(steady, key(59)).coverage).toBeGreaterThan(viewOf(sloppy, key(59)).coverage);
  });
  it('sınav tarihinden sonra yeni blok açılmaz', () => {
    const near: SlotInput = { ...DGS, date: key(5) };
    const { core } = run([near], 9, () => 'done');
    expect((core.committed[key(8)] ?? []).filter(b => b.planKey === 'dgs')).toHaveLength(0);
  });
  it('yeni konu listesiyle büyük sınav da çalışır: YKS, iki sınav birlikte', () => {
    const yks: SlotInput = { slot: 'exam', name: 'YKS', date: key(200), dailyMinutes: 120 };
    const ielts: SlotInput = { slot: 'exam2', name: 'IELTS', date: key(60), dailyMinutes: 45 };
    const { core } = run([yks, ielts], 40, () => 'done');
    const plans = (core.committed[key(39)] ?? []).map(b => b.planKey);
    expect(plans.length).toBeGreaterThan(0);
    expect(loadOf(core, key(39))).toBeLessThanOrEqual(165);
    expect(Object.keys(core.plans)).toEqual(expect.arrayContaining(['yks', 'ielts']));
  });
  it('tarih değişince yapılan iş durur, plan yeni tarihe göre yeniden kurulur', () => {
    const { core } = run([DGS], 10, () => 'done');
    const doneBefore = covered(core);
    const moved = syncCore(core, [{ ...DGS, date: key(60) }], key(10), 500);
    expect(moved.notice).toEqual({ type: 'date', planKey: 'dgs' });
    expect(covered(moved)).toBeGreaterThanOrEqual(doneBefore);
  });
});

describe('bir konu tek satır', () => {
  const block = (id: string, min: number, extra = {}) => ({ id, type: 'yeni', unitId: 'ielts', topicId: 'map', min, planKey: 'ielts', done: false, ...extra }) as never;
  it('iki açık blok birleşir, kimlik yeni süreyi taşır', () => {
    const r = mergeOpenBlocks([block('a', 34), block('b', 27)], START);
    expect(r).toHaveLength(1);
    expect((r[0] as unknown as { min: number }).min).toBe(61);
    expect((r[0] as unknown as { id: string }).id).toContain('61');
  });
  it('bitmiş blok dokunulmaz, kalan süre ayrı satır', () => {
    expect(mergeOpenBlocks([block('a', 50, { done: true }), block('b', 35)], START)).toHaveLength(2);
  });
});

describe('gün geçince yapılmamış iş', () => {
  it.each([
    [['spor', 'daily', 'fitness'], 'retire'],
    [['tasarruf', 'daily', 'finance'], 'retire'],
    [['ramazan', 'daily'], 'retire'],
    [['exam', 'daily'], 'retire'],
    [['spor'], 'rollover'],
    [['ramazan'], 'rollover'],
    [['tez'], 'rollover'],
    [['birakma'], 'rollover'],
    [['ramazan_kadir', 'ramazan'], 'retire'],
    [['kilo_adapt', 'spor'], 'retire'],
    [['personal'], 'retire'],
    [null, 'retire'],
  ])('%j → %s', (tags, expected) => {
    expect(overdueAction(tags as string[] | null)).toBe(expected);
  });
});

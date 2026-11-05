import fs from 'fs';
import path from 'path';
import { cloudMocks, emptyCore, mergeCloud, SlotInput, StudyCore, syncCore, toCloud } from '@/features/studyplan/utils/planCore';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { blueprintFor } from '@/features/studyplan/data/blueprints';
import { GOAL_LIMITS, nextFreeSlot, quitRoomLeft } from '@/features/modes/utils/goalRows';

/* DENEME KAYITLARI KAYBOLMAZ (2026-11-05). Kaydet, kapat-aç, çıkış-giriş, yeni cihaz, iki cihaz, plan kapanışı, sınır. */
const TODAY = '2027-01-04';
const DGS: SlotInput = { slot: 'exam', name: 'DGS', date: '2027-07-18', dailyMinutes: 90 };
const mock = (i: number, extra: Record<string, unknown> = {}) => ({ id: `m${i}`, day: `2027-01-${String((i % 27) + 1).padStart(2, '0')}`, unitId: 'dgs', sections: {}, total: 40 + (i % 50), misses: [{ topicId: 'dgs_sozel_paragraf', reason: 'unuttum' }], ...extra }) as never;
const withMocks = (n: number): StudyCore => {
  const c = syncCore(emptyCore(), [DGS], TODAY, 1);
  return { ...c, plans: { ...c.plans, dgs: { ...c.plans.dgs, mocks: Array.from({ length: n }, (_, i) => mock(i)) } } };
};
/** JSON'dan geçer: buluta gidip gelmek budur. */
const roundTrip = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('deneme kaydı kaybolmaz', () => {
  it('yeni cihaz: bulut kopyasından hepsi gelir, puanlar aynı', () => {
    const cloud = roundTrip(toCloud(withMocks(5)));
    const fresh = mergeCloud(emptyCore(), cloud);
    expect(fresh.plans.dgs.mocks.map(m => m.total)).toEqual(withMocks(5).plans.dgs.mocks.map(m => m.total));
  });
  it('çok denemede eskiler de gider: yalnız ayrıntı düşer, puan kalır', () => {
    const sent = roundTrip(toCloud(withMocks(150))).plans.dgs.mocks;
    expect(sent).toHaveLength(150);
    expect(sent[0].total).toBe(40);
    expect(sent[0].misses).toBeUndefined();
    expect(sent[149].misses).toHaveLength(1);
  });
  it('boş bulut dolu yereli silmez', () => {
    const local = withMocks(3);
    expect(mergeCloud(local, null)).toBe(local);
    expect(mergeCloud(local, roundTrip(toCloud(emptyCore()))).plans.dgs.mocks).toHaveLength(3);
  });
  it('iki cihazda ayrı girilen denemeler birleşir, kopya oluşmaz', () => {
    const a = withMocks(2);
    const b = { ...a, plans: { ...a.plans, dgs: { ...a.plans.dgs, mocks: [mock(0), mock(7)] } } };
    const merged = mergeCloud(a, roundTrip(toCloud(b)));
    expect(merged.plans.dgs.mocks.map(m => m.id).sort()).toEqual(['m0', 'm1', 'm7']);
  });
  it('silinen deneme başka cihazdan geri dönmez', () => {
    const a = withMocks(2);
    const removedHere = { ...a, plans: { ...a.plans, dgs: { ...a.plans.dgs, mocks: [mock(1)], removedMocks: ['m0'] } } };
    expect(mergeCloud(a, roundTrip(toCloud(removedHere))).plans.dgs.mocks.map(m => m.id)).toEqual(['m1']);
    expect(mergeCloud(removedHere, roundTrip(toCloud(a))).plans.dgs.mocks.map(m => m.id)).toEqual(['m1']);
  });
  it('sınav kapatılınca kayıtlar silinmez; aynı sınav açılınca geri gelir', () => {
    const closed = syncCore(withMocks(4), [], TODAY, 2);
    expect(closed.plans.dgs.slot).toBeNull();
    expect(closed.plans.dgs.mocks).toHaveLength(4);
    const cloudOfClosed = mergeCloud(emptyCore(), roundTrip(toCloud(closed)));
    expect(syncCore(cloudOfClosed, [DGS], TODAY, 3).plans.dgs.mocks).toHaveLength(4);
  });
  it('plan yeniden kurulsa da, günler geçse de kayıtlar durur', () => {
    let c = withMocks(4);
    for (const day of ['2027-01-05', '2027-01-20', '2027-03-01']) c = syncCore(c, [DGS], day, 9, { replan: true });
    expect(c.plans.dgs.mocks).toHaveLength(4);
  });
  it('en kötü durumda da sunucu sınırına (200 KB) uzak: üç sınav, sınav başına 150 deneme', () => {
    const base = withMocks(150);
    const plans = { ...base.plans, a: { ...base.plans.dgs, key: 'a' }, b: { ...base.plans.dgs, key: 'b' } };
    expect(JSON.stringify(toCloud({ ...base, plans })).length).toBeLessThan(120_000);
    expect(cloudMocks([])).toEqual([]);
  });
  it('kayıt yolu: deneme depoya yazılır, buluta bildirilir, cihazda kalıcıdır', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/studyplan/store/useStudyPlanStore.ts'), 'utf8');
    expect(src).toContain("name: 'tazq-study-plan'");
    const bp = blueprintFor('DGS')!;
    useStudyPlanStore.setState({ ...syncCore(emptyCore(), [DGS], TODAY, 1) });
    useStudyPlanStore.getState().addMock('dgs', mock(1), bp.score, TODAY);
    expect(useStudyPlanStore.getState().plans.dgs.mocks.map(m => m.id)).toEqual(['m1']);
    useStudyPlanStore.getState().removeMock('dgs', 'm1');
    expect(useStudyPlanStore.getState().plans.dgs.mocks).toHaveLength(0);
    expect(useStudyPlanStore.getState().plans.dgs.removedMocks).toEqual(['m1']);
  });
});

describe('çoklu hedef', () => {
  const slots: [string, string, string] = ['exam', 'exam2', 'exam3'];
  it('sıradaki boş yuvayı bulur; 3 doluysa satır çıkmaz', () => {
    expect(nextFreeSlot(['DGS', '', ''], slots)).toBe('exam2');
    expect(nextFreeSlot(['DGS', 'YDS', ''], slots)).toBe('exam3');
    expect(nextFreeSlot(['DGS', 'YDS', 'ALES'], slots)).toBeNull();
    expect(nextFreeSlot(['', 'YDS', ''], slots)).toBe('exam');
  });
  it('Keşfet satırı kartın formunu açar; üç kartta da bağlı', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    expect(read('features/modes/components/GoalRows.tsx')).toContain('useGoalSetupStore.getState().open(r.key, r.slot as string)'); // 2026-11-05: ekleme adım adım kurulumdan
    expect(read('app/modlar.tsx')).toContain('goalAddRows(seasonal');
    for (const f of ['Mulakat', 'Spor']) expect(read(`features/modes/components/modes/${f}Card.tsx`)).toContain('useAddRequest(slot, () => setExpanded(true))');
  });
});

describe('hedef sınırları', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('sayılar kararla aynı', () => {
    expect(GOAL_LIMITS).toEqual({ exam: 3, mulakat: 3, spor: 2, birakma: 3 });
    expect(quitRoomLeft(0)).toBe(3);
    expect(quitRoomLeft(2, 1)).toBe(0);
    expect(quitRoomLeft(5)).toBe(0);
  });
  it('fiziksel: yeni üçüncü yuva açılmaz, eski kayıt görünür kalır; ikinci hedefte kilo yok', () => {
    const src = read('features/modes/components/modes/SporCard.tsx');
    expect(src).toContain('spor2Complete && !!seasonal.spor3Goal');
    expect(src).toContain("filter(g => g.key !== 'kilo'");
    expect(read('features/modes/components/GoalRows.tsx')).toContain("nextFreeSlot([s.sporGoal, s.spor2Goal], ['spor', 'spor2'])");
  });
  it('bırakma: sınırda yeni eklenemez, eski fazla kayıt silinmez', () => {
    const card = read('features/modes/components/modes/BirakmaCard.tsx');
    expect(card).toContain('items.length + selectedKeys.length <= GOAL_LIMITS.birakma');
    expect(card).not.toMatch(/slice\(0, GOAL_LIMITS/);
  });
  it('bırakmada türe özel görevler ilk gün yığılmaz, önek metnin dilinde', () => {
    const card = read('features/modes/components/modes/BirakmaCard.tsx');
    expect(read('features/modes/utils/lifePlanStart.ts')).toContain("staged.setQueue('birakma'");
    expect(read('features/modes/utils/lifePlanStart.ts')).toContain("pick(isTr, 'Bırakma', 'Quit')");
    expect(read('features/modes/utils/lifePlanStart.ts')).toContain('withLabel(t.titleEn, false)');
  });
  it('boş kutu tutarı sıfırlamaz; veri bu cihazda yoksa boş kumbara gösterilmez', () => {
    const src = read('features/modes/components/plan/track/SavingsTrack.tsx');
    expect(src).toContain('!text.trim()');
    expect(src).toContain('c.deviceOnly');
  });
});

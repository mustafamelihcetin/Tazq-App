import { addCustomSubject, addCustomTopic, emptyCore, mergeCloud, removeCustomTopic, setTopicWeight, toCloud, unitsOfPlan, CUSTOM_TOPICS_MAX, type PlanRecord } from '@/features/studyplan/utils/planCore';
import { topicName, subjectName } from '@/features/studyplan/utils/planBridge';

const base = (): PlanRecord => ({ key: 'kpss', name: 'KPSS', slot: 'exam', examDate: '2027-06-01', levels: {}, excluded: [], states: {}, mocks: [], createdAt: 1, at: 1 });
const topics = (p: PlanRecord) => unitsOfPlan(p).flatMap(u => u.topics);

describe('elle konu', () => {
  it('hazır listeye eklenir, adı görünür, planlayıcıya girer', () => {
    const before = topics(base()).length;
    expect(before).toBeGreaterThan(0);
    const sub = topics(base())[0].subject;
    const p = addCustomTopic(base(), sub, 'Yeni çıkan konu', 'mid')!;
    const list = topics(p);
    expect(list).toHaveLength(before + 1);
    const added = list[list.length - 1].subject === sub ? list.find(t => topicName(p, t.id, 'tr') === 'Yeni çıkan konu') : list.find(t => topicName(p, t.id, 'tr') === 'Yeni çıkan konu');
    expect(added?.subject).toBe(sub);
  });

  it('aynı ad iki kez eklenmez, boş ad eklenmez, sınır aşılmaz', () => {
    const p = addCustomTopic(base(), 's', 'Konu', 'mid')!;
    expect(addCustomTopic(p, 's', ' KONU ', 'high')).toBeNull();
    expect(addCustomTopic(p, 's', '   ', 'mid')).toBeNull();
    let many: PlanRecord = base();
    for (let i = 0; i < CUSTOM_TOPICS_MAX; i++) many = addCustomTopic(many, 's', `k${i}`, 'mid')!;
    expect(addCustomTopic(many, 's', 'fazla', 'mid')).toBeNull();
  });

  it('kendi dersi eklenir, adı döner, ilk konusu o derse gider', () => {
    const p = addCustomSubject(base(), 'Benim Dersim')!;
    const sub = p.customSubjects![0].id;
    expect(subjectName(p, sub, 'tr')).toBe('Benim Dersim');
    const q = addCustomTopic(p, sub, 'İlk konu', 'high')!;
    expect(topics(q).some(t => t.subject === sub)).toBe(true);
  });

  it('ağırlık payı değiştirir: çok > orta > az; orta kaydedilmez', () => {
    const p = base();
    const t = topics(p)[0];
    const hi = topics(setTopicWeight(p, t.id, 'high')).find(x => x.id === t.id)!;
    const lo = topics(setTopicWeight(p, t.id, 'low')).find(x => x.id === t.id)!;
    expect(hi.q).toBeGreaterThan(t.q);
    expect(lo.q).toBeLessThan(t.q);
    expect(hi.hours).toBeGreaterThan(lo.hours);
    expect(setTopicWeight(setTopicWeight(p, t.id, 'high'), t.id, 'mid').weights).toEqual({});
  });

  it('kaldırılan konunun ağırlığı ve durumu da gider: sunucuda artık kalmaz', () => {
    let p = addCustomTopic(base(), 's', 'Konu', 'high')!;
    const id = p.customTopics![0].id;
    p = { ...p, states: { kpss: { topics: { [id]: { cov: 0.5 } } } } as never };
    p = removeCustomTopic(p, id);
    expect(p.customTopics).toEqual([]);
    expect(p.weights?.[id]).toBeUndefined();
    expect((p.states as never as { kpss: { topics: Record<string, unknown> } }).kpss.topics[id]).toBeUndefined();
  });

  it('buluta yalnız fark gider ve daha yeni kopya öteki cihaza geçer', () => {
    const p = { ...addCustomTopic(base(), 's', 'Konu', 'high')!, at: 5 };
    const core = { ...emptyCore(), plans: { kpss: p } };
    const cloud = toCloud(core);
    expect(cloud.plans.kpss.customTopics).toHaveLength(1);
    // Hazır konular buluta kopyalanmaz: kayıt yalnız kullanıcının farkıdır.
    expect(JSON.stringify(cloud.plans.kpss).length).toBeLessThan(400);
    const merged = mergeCloud({ ...emptyCore(), plans: { kpss: base() } }, cloud);
    expect(merged.plans.kpss.customTopics).toHaveLength(1);
    expect(merged.plans.kpss.weights).toEqual(p.weights);
  });
});

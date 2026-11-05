/*
  Planın uygulamaya bağlandığı yol: gerçek store'lar, sunucu sahte. Görev tamamlanınca plan öğrenir; plan değişince eski görev kalkar ve
  geri gelmez; dünün kalanı kaldırılır.
*/
jest.mock('@/shared/services/api', () => ({
  TaskService: { deleteTask: jest.fn(() => Promise.resolve()), updateTask: jest.fn(() => Promise.resolve()), createTask: jest.fn() },
  UserService: { updateProfile: jest.fn(() => Promise.resolve()) },
  AiService: {},
  SupportService: {},
}));

import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { isStudyManaged, retireOrphanStudyTasks, runStudySync, setStudyBlockDone, startStudyPlanBridge, studyBlocksForSlot, studySlots, studyTaskMissing, studyToday } from '@/features/studyplan/sync';
import { blocksToTasks } from '@/features/studyplan/utils/planBridge';
import { blockTag, emptyCore } from '@/features/studyplan/utils/planCore';
import { dayKeyOf, dayNum } from '@/features/studyplan/utils/scheduler';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

const TODAY = studyToday();
const future = dayKeyOf(dayNum(TODAY) + 200);

function setupExam(name = 'DGS') {
  usePrefsStore.setState(s => ({
    seasonal: { ...s.seasonal, examMode: true, examName: name, examDate: future },
    examPlanHabitIds: ['h1'],
    planSpecs: { ...s.planSpecs, exam: { dailyMinutes: 90 } },
  }));
}
const asTasks = () => {
  const c = useStudyPlanStore.getState();
  return blocksToTasks(c.committed[TODAY] ?? [], c, TODAY, 'exam', 4).map((t, i) => ({ ...t, id: i + 1 })) as never[];
};

beforeEach(() => {
  useStudyPlanStore.setState(emptyCore());
  useTaskStore.setState({ tasks: [] } as never);
  useOfflineQueue.getState().clear();
});

describe('slotlar', () => {
  it('kapalı ya da kurulmamış sınav plana girmez', () => {
    usePrefsStore.setState(s => ({ seasonal: { ...s.seasonal, examMode: false, examName: '', examDate: null, exam2Name: '', exam2Date: null, exam3Name: '', exam3Date: null }, examPlanHabitIds: [], examPlanTaskIds: [] }));
    expect(studySlots(TODAY)).toEqual([]);
    setupExam();
    expect(studySlots(TODAY)).toMatchObject([{ slot: 'exam', name: 'DGS', date: future, dailyMinutes: 90 }]);
  });
  it('tarih yerel güne çevrilir', () => {
    setupExam();
    usePrefsStore.setState(s => ({ seasonal: { ...s.seasonal, examDate: `${future}T12:00:00` } }));
    expect(studySlots(TODAY)[0].date).toBe(future);
  });
  it('bilinen sınav planlayıcıya geçer, konusu olmayan eski motorda kalır', () => {
    setupExam();
    runStudySync(TODAY);
    expect(isStudyManaged('DGS')).toBe(true);
    expect(studyBlocksForSlot('exam', 'DGS', TODAY)?.length).toBeGreaterThan(0);
    setupExam('Ehliyet Sınavı');
    runStudySync(TODAY);
    expect(isStudyManaged('Ehliyet Sınavı')).toBe(false);
    expect(studyBlocksForSlot('exam', 'Ehliyet Sınavı', TODAY)).toBeNull();
  });
  it('kurulumda seçilen zayıf konu ve süre plana geçer; süre sonradan da izlenir', () => {
    setupExam();
    usePrefsStore.setState(s => ({ planSpecs: { ...s.planSpecs, exam: { dailyMinutes: 90, weakTopicIds: ['dgs_sayisal_geometri'] } } }));
    runStudySync(TODAY);
    const st = useStudyPlanStore.getState();
    expect(st.plans.dgs.weakIds).toEqual(['dgs_sayisal_geometri']);
    expect(st.week?.[1]).toBe(90);
    usePrefsStore.setState(s => ({ planSpecs: { ...s.planSpecs, exam: { dailyMinutes: 150, weakTopicIds: ['dgs_sayisal_geometri'] } } }));
    runStudySync(TODAY);
    expect(useStudyPlanStore.getState().week?.[1]).toBe(150);
  });
  it('ikinci sınavın süresi eklenir, birincinin süresini yarıya indirmez; kapanınca düşer', () => {
    setupExam();
    runStudySync(TODAY);
    usePrefsStore.setState(s => ({ seasonal: { ...s.seasonal, exam2Name: 'IELTS', exam2Date: future }, exam2PlanHabitIds: ['h2'], planSpecs: { ...s.planSpecs, exam2: { dailyMinutes: 45 } } }));
    runStudySync(TODAY);
    expect(useStudyPlanStore.getState().week?.[1]).toBe(135);
    usePrefsStore.setState(s => ({ seasonal: { ...s.seasonal, exam2Name: '', exam2Date: null }, exam2PlanHabitIds: [] }));
    runStudySync(TODAY);
    expect(useStudyPlanStore.getState().week?.[1]).toBe(90);
  });
  it('kullanıcı günleri ayrı ayarladıysa kurulum süresi ezmez', () => {
    setupExam();
    runStudySync(TODAY);
    useStudyPlanStore.getState().setWeek([240, 60, 60, 60, 60, 60, 240], TODAY);
    usePrefsStore.setState(s => ({ planSpecs: { ...s.planSpecs, exam: { dailyMinutes: 150 } } }));
    runStudySync(TODAY);
    expect(useStudyPlanStore.getState().week).toEqual([240, 60, 60, 60, 60, 60, 240]);
  });
});

describe('görev köprüsü', () => {
  beforeEach(() => { setupExam(); runStudySync(TODAY); startStudyPlanBridge(); useTaskStore.setState({ tasks: asTasks() } as never); });

  it('Bugün listesinden tamamlanan görev planı işaretler', () => {
    const first = useTaskStore.getState().tasks[0];
    useTaskStore.getState().toggleTaskCompletion(first.id);
    expect(useStudyPlanStore.getState().committed[TODAY][0].done).toBe(true);
    useTaskStore.getState().toggleTaskCompletion(first.id);
    expect(useStudyPlanStore.getState().committed[TODAY][0].done).toBe(false);
  });
  it('plan ekranından işaretleme görevi de tamamlar', async () => {
    const b = useStudyPlanStore.getState().committed[TODAY][0];
    await setStudyBlockDone(b.id, true, TODAY);
    expect(useTaskStore.getState().tasks.find(t => (t.tags ?? []).includes(b.id))?.isCompleted).toBe(true);
    expect(useStudyPlanStore.getState().committed[TODAY][0].done).toBe(true);
  });
  it('çevrimdışı işaretleme kuyruğa girer', async () => {
    useNetworkStore.setState({ isOnline: false } as never);
    const b = useStudyPlanStore.getState().committed[TODAY][0];
    await setStudyBlockDone(b.id, true, TODAY);
    expect(useOfflineQueue.getState().ops.some(q => q.type === 'toggle-task')).toBe(true);
    useNetworkStore.setState({ isOnline: true } as never);
  });
  it('plan değişince eski görevler kalkar ve plana geri sızmaz', () => {
    const before = useStudyPlanStore.getState().committed[TODAY];
    const oldTag = blockTag(TODAY, { type: 'yeni', topicId: 'dgs_sayisal_veri', unitId: 'dgs', min: 11 });
    const oldTag2 = blockTag(TODAY, { type: 'yeni', topicId: 'dgs_sayisal_islemler', unitId: 'dgs', min: 12 });
    useTaskStore.setState({ tasks: [{ id: 50, title: 'a', tags: ['exam', oldTag] }, { id: 51, title: 'b', tags: ['exam', oldTag2] }] } as never);
    useStudyPlanStore.setState({ committed: { ...useStudyPlanStore.getState().committed, [TODAY]: before.filter(b => b.id !== oldTag && b.id !== oldTag2) } });
    const count = useStudyPlanStore.getState().committed[TODAY].length;
    retireOrphanStudyTasks(TODAY);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    expect(useStudyPlanStore.getState().committed[TODAY]).toHaveLength(count);
  });
  it('görevi inmemiş sınav tespit edilir', () => {
    expect(studyTaskMissing(TODAY)).toBe(false);
    useTaskStore.setState({ tasks: [] } as never);
    expect(studyTaskMissing(TODAY)).toBe(true);
  });
  it('dünden kalan görev gecikmişe düşmez, yapılmış görev kalır', () => {
    const y = dayKeyOf(dayNum(TODAY) - 1);
    useTaskStore.setState({ tasks: [
      { id: 60, title: 'dün yapılmadı', tags: ['exam', blockTag(y, { type: 'yeni', topicId: 'x', unitId: 'dgs', min: 10 })] },
      { id: 61, title: 'dün yapıldı', isCompleted: true, tags: ['exam', blockTag(y, { type: 'yeni', topicId: 'z', unitId: 'dgs', min: 10 })] },
    ] } as never);
    runStudySync(TODAY);
    expect(useTaskStore.getState().tasks.map(t => t.id)).toEqual([61]);
  });
});

describe('ayar değişiklikleri', () => {
  beforeEach(() => { setupExam(); runStudySync(TODAY); });

  it('süre düşünce bugünün planı da küçülür; kapasite aşılmaz', () => {
    useStudyPlanStore.getState().setWeek([30, 30, 30, 30, 30, 30, 30], TODAY);
    const load = useStudyPlanStore.getState().committed[TODAY].reduce((a, b) => a + b.min, 0);
    expect(load).toBeLessThanOrEqual(30);
  });
  it('bir blok yapıldıktan sonra süre değişince kalan süre yeniden planlanır, yapılan durur', () => {
    const b = useStudyPlanStore.getState().committed[TODAY][0];
    useStudyPlanStore.getState().toggleBlock(TODAY, b.id, true);
    useStudyPlanStore.getState().setWeek([180, 180, 180, 180, 180, 180, 180], TODAY);
    const list = useStudyPlanStore.getState().committed[TODAY];
    expect(list.find(x => x.id === b.id)?.done).toBe(true);
    expect(list.some(x => !x.done)).toBe(true);
    expect(list.reduce((a, x) => a + x.min, 0)).toBeLessThanOrEqual(180);
    expect(useStudyPlanStore.getState().refill).toBeUndefined();
  });
  it('dersi çıkarınca plana gelmez, geri alınca döner', () => {
    const s = useStudyPlanStore.getState();
    s.setExcluded('dgs', 'dgs_sayisal', true, TODAY);
    expect(useStudyPlanStore.getState().committed[TODAY].some(b => b.subject === 'dgs_sayisal')).toBe(false);
    s.setExcluded('dgs', 'dgs_sayisal', false, TODAY);
    expect(useStudyPlanStore.getState().plans.dgs.excluded).toEqual([]);
  });
  it('seviye yalnız henüz çalışılmamış konuyu etkiler', () => {
    const s = useStudyPlanStore.getState();
    s.topicDone('dgs', 'dgs', 'dgs_sozel_anlam', 'orta', TODAY);
    s.setLevel('dgs', 'dgs_sozel', 'tekrar', TODAY);
    const st = useStudyPlanStore.getState().plans.dgs.states.dgs.topics;
    expect(st.dgs_sozel_anlam.cov).toBe(1);
    expect(st.dgs_sozel_paragraf.cov).toBe(0.75);
  });
  it('kendi dersleri: yazılan konular planlanır', () => {
    setupExam('Finaller');
    runStudySync(TODAY);
    const key = Object.values(useStudyPlanStore.getState().plans).find(p => p.name === 'Finaller')!.key;
    useStudyPlanStore.getState().setCourses(key, [{ id: 'fz', name: 'Fizik', date: dayKeyOf(dayNum(TODAY) + 10), topics: [{ id: 't1', name: 'Kuvvet' }] }], TODAY);
    const blocks = useStudyPlanStore.getState().committed[TODAY];
    expect(blocks.some(b => b.topicId === 't1')).toBe(true);
    expect(isStudyManaged('Finaller')).toBe(true);
  });
  it('deneme kaydı: yanlış nedeni plana işlenir, sıfırlama hepsini temizler', () => {
    const s = useStudyPlanStore.getState();
    s.addMock('dgs', { id: 'm1', day: TODAY, unitId: 'dgs', sections: { dgs_sozel: { correct: 40, wrong: 5 }, dgs_sayisal: { correct: 10, wrong: 25 } }, misses: [{ topicId: 'dgs_sayisal_geometri', reason: 'sure' }] }, { kind: 'net', penalty: 0.25 }, TODAY);
    const p = useStudyPlanStore.getState().plans.dgs;
    expect(p.mocks).toHaveLength(1);
    expect(p.states.dgs.practice).toEqual(['dgs_sayisal_geometri']);
    expect(p.states.dgs.boost.dgs_sayisal).toBeGreaterThan(1);
    expect(useStudyPlanStore.getState().committed[TODAY][0]).toMatchObject({ type: 'pratik', topicId: 'dgs_sayisal_geometri' });
    s.resetPlan('dgs', TODAY);
    expect(useStudyPlanStore.getState().plans.dgs.mocks).toHaveLength(0);
  });
  it('erken bitiren isterse bir blok daha alır', () => {
    const s = useStudyPlanStore.getState();
    const n = useStudyPlanStore.getState().committed[TODAY].length;
    s.addExtra(TODAY);
    expect(useStudyPlanStore.getState().committed[TODAY].length).toBe(n + 1);
  });
});

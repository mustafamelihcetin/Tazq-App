import AsyncStorage from '@react-native-async-storage/async-storage';
import { repairStagedQueuesOnce, formatWithPrefix } from '@/features/modes/utils/stagedRepair';
import { releaseStagedPlanItems } from '@/features/modes/utils/stagedRollout';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { TaskService } from '@/shared/services/api';

const USER = 7;
const SET = (k: string, v: unknown) => usePrefsStore.getState().setSeasonalPref(k as never, v as never);
const queue = (slot = 'exam') => useStagedPlanStore.getState().queues[slot];
const titles = (slot = 'exam') => queue(slot).items.flatMap((e) => (e.kind === 'task' ? [e.item.titleTr] : []));
const habitsIn = (slot = 'exam') => queue(slot).items.flatMap((e) => (e.kind === 'habit' ? [e.item.nameTr] : []));

beforeEach(async () => {
  await AsyncStorage.clear();
  useStagedPlanStore.getState().reset();
  useTaskStore.setState({ tasks: [] });
  useHabitStore.setState({ habits: [] });
  useCompletionStore.setState({ events: [] });
  usePrefsStore.setState({ cloudHydratedFor: USER } as never);
  SET('examMode', true); SET('examName', 'KPSS'); SET('examDate', '2027-06-20');
  usePrefsStore.getState().setPlanIds('exam', [], [1]);
  // Hatanın bıraktığı hal: kuyruk boşalmış, açılım bir kez çalışmış.
  useStagedPlanStore.setState({ queues: { exam: { items: [], lastUnlockDay: '2026-11-05' } } });
});

describe('kaybolan plan adımları', () => {
  it('eksikler kuyruğa döner, listeye dökülmez', async () => {
    const added = await repairStagedQueuesOnce(USER);
    expect(added).toBeGreaterThan(0);
    expect(titles().join('|')).toContain('Eğitim Bilimleri');
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    expect(queue().lastUnlockDay).toBe('2026-11-05');
  });

  it('listede olan, başka dilde ya da öneksiz olan görev geri gelmez', async () => {
    useTaskStore.setState({ tasks: [
      { id: 1, title: 'KPSS: Eğitim Bilimleri kaynak kitap temin et', isCompleted: false, tags: [] },
      { id: 2, title: 'Download the last 5 years of KPSS past questions', isCompleted: false, tags: [] },
    ] } as never);
    await repairStagedQueuesOnce(USER);
    expect(titles().join('|')).not.toContain('Eğitim Bilimleri');
    expect(titles().join('|')).not.toContain('Son 5 yıl KPSS');
  });

  it('yapılıp listeden kalkmış görev geri gelmez', async () => {
    useCompletionStore.setState({ events: [{ id: 'e', taskId: 1, taskName: 'KPSS: Eğitim Bilimleri kaynak kitap temin et', completedAt: '2026-11-01T10:00:00Z' }] });
    await repairStagedQueuesOnce(USER);
    expect(titles().join('|')).not.toContain('Eğitim Bilimleri');
  });

  it('var olan alışkanlık geri gelmez, eksiği döner', async () => {
    await repairStagedQueuesOnce(USER);
    const all = habitsIn();
    expect(all.length).toBeGreaterThan(0);
    await AsyncStorage.clear();
    useStagedPlanStore.setState({ queues: { exam: { items: [], lastUnlockDay: '2026-11-05' } } });
    useHabitStore.setState({ habits: [{ id: 'h', name: all[0], emoji: 'x', color: '#000', completedDates: [], createdAt: '' }] } as never);
    await repairStagedQueuesOnce(USER);
    expect(habitsIn()).not.toContain(all[0]);
  });

  it('bir kez çalışır; ikinci açılışta yığılmaz', async () => {
    await repairStagedQueuesOnce(USER);
    const count = queue().items.length;
    expect(await repairStagedQueuesOnce(USER)).toBe(0);
    expect(queue().items).toHaveLength(count);
  });

  it('sağlam kuyruktaki adım iki kez girmez', async () => {
    await repairStagedQueuesOnce(USER);
    const intact = queue().items;
    await AsyncStorage.clear();
    await repairStagedQueuesOnce(USER);
    expect(queue().items).toEqual(intact);
  });

  it('kuyruğu hiç çalışmamış ve kapalı planlara dokunmaz', async () => {
    useStagedPlanStore.setState({ queues: { exam: { items: [], lastUnlockDay: null } } });
    expect(await repairStagedQueuesOnce(USER)).toBe(0);
    await AsyncStorage.clear();
    useStagedPlanStore.setState({ queues: { exam: { items: [], lastUnlockDay: '2026-11-05' } } });
    SET('examMode', false);
    expect(await repairStagedQueuesOnce(USER)).toBe(0);
  });

  it('bulut tercihleri gelmeden çalışıp hakkını tüketmez', async () => {
    usePrefsStore.setState({ cloudHydratedFor: null } as never);
    expect(await repairStagedQueuesOnce(USER)).toBe(0);
    usePrefsStore.setState({ cloudHydratedFor: USER } as never);
    expect(await repairStagedQueuesOnce(USER)).toBeGreaterThan(0);
  });

  it('dönen adımlar günde birer açılır', async () => {
    const createTask = jest.spyOn(TaskService, 'createTask').mockResolvedValue({ id: 99 } as never);
    const yesterday = fmtDateKey(new Date(Date.now() - 86400000));
    useHabitStore.setState({ habits: [{ id: 'h1', name: 'Çalışma', emoji: 'x', color: '#000', completedDates: [yesterday], createdAt: '' }] } as never);
    usePrefsStore.getState().setPlanIds('exam', ['h1'], []);
    await repairStagedQueuesOnce(USER);
    await releaseStagedPlanItems();
    await releaseStagedPlanItems();
    expect(createTask.mock.calls.length + (useHabitStore.getState().habits.length - 1)).toBe(1);
    createTask.mockRestore();
  });

  it.each([
    ['tez', { tezMode: true, tezName: 'Tez', tezDate: '2027-06-20' }],
    ['mulakat', { mulakatMode: true, mulakatName: 'Acme', mulakatDate: '2027-01-20' }],
    ['spor', { sporMode: true, sporGoal: 'Kilo ver', sporDate: '2027-06-20' }],
    ['tasarruf', { tasarrufMode: true, tasarrufName: 'Birikim' }],
    ['birakma', { birakmaMode: true, birakmaName: 'Sigara' }],
  ])('%s modu da onarılır', async (slot, prefs) => {
    Object.entries(prefs).forEach(([k, v]) => SET(k, v));
    useStagedPlanStore.setState({ queues: { [slot]: { items: [], lastUnlockDay: '2026-11-05' } } });
    expect(await repairStagedQueuesOnce(USER)).toBeGreaterThan(0);
  });
});

describe('önek', () => {
  it('kurulumla aynı biçim', () => {
    expect(formatWithPrefix('Kaynak al', 'KPSS')).toBe('KPSS: Kaynak al');
    expect(formatWithPrefix('KPSS: Kaynak al', 'KPSS')).toBe('KPSS: Kaynak al');
    expect(formatWithPrefix('KPSS deneme çöz', 'KPSS')).toBe('KPSS: deneme çöz');
  });
});

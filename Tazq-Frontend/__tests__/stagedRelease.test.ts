/**
 * Kademeli açılımın günlük adımı — gerçek depolarla; yalnız sunucu çağrısı taklit.
 */
import { releaseStagedPlanItems } from '@/features/modes/utils/stagedRollout';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';

const createTask = jest.spyOn(TaskService, 'createTask');
const yesterday = fmtDateKey(new Date(Date.now() - 86400000));
const task = { kind: 'task' as const, item: { titleTr: 'Tez: Kaynak tara', titleEn: 'Thesis: Scan sources', priority: 'Medium', tags: ['tez'] } };
const habit = { kind: 'habit' as const, item: { nameTr: 'Okuma', nameEn: 'Reading', emoji: '📖', color: '#00f', modeType: 'tez' } };

beforeEach(() => {
  createTask.mockReset();
  createTask.mockResolvedValue({ id: 99 } as never);
  useStagedPlanStore.getState().reset();
  useTaskStore.setState({ tasks: [] });
  useHabitStore.setState({ habits: [{ id: 'h1', name: 'Yazım', emoji: '✍️', color: '#000', completedDates: [], createdAt: '' } as never] });
  usePrefsStore.getState().setPlanIds('tez', ['h1'], []);
  usePrefsStore.getState().setSeasonalPref('tezMode', true);
});

const markYesterday = () =>
  useHabitStore.setState({ habits: [{ id: 'h1', name: 'Yazım', emoji: '✍️', color: '#000', completedDates: [yesterday], createdAt: '' } as never] });

describe('günlük açılım', () => {
  it('dün plan işi yapıldıysa sıradaki görev açılır ve plana bağlanır', async () => {
    markYesterday();
    useStagedPlanStore.getState().setQueue('tez', [task, habit]);
    await releaseStagedPlanItems();
    expect(createTask).toHaveBeenCalledTimes(1);
    expect((usePrefsStore.getState() as any).tezPlanTaskIds).toContain(99);
    expect(useStagedPlanStore.getState().queues.tez.items).toEqual([habit]);
  });

  it('aynı gün ikinci kez açmaz', async () => {
    markYesterday();
    useStagedPlanStore.getState().setQueue('tez', [task, habit]);
    await releaseStagedPlanItems();
    await releaseStagedPlanItems();
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(useStagedPlanStore.getState().queues.tez.items).toHaveLength(1);
  });

  it('dün tamamlama yoksa yük artmaz', async () => {
    useStagedPlanStore.getState().setQueue('tez', [task]);
    await releaseStagedPlanItems();
    expect(createTask).not.toHaveBeenCalled();
    expect(useStagedPlanStore.getState().queues.tez.items).toHaveLength(1);
  });

  it('sunucu hatasında öğe sırada kalır (kaybolmaz)', async () => {
    markYesterday();
    createTask.mockRejectedValueOnce(new Error('offline'));
    useStagedPlanStore.getState().setQueue('tez', [task]);
    await releaseStagedPlanItems();
    expect(useStagedPlanStore.getState().queues.tez.items).toHaveLength(1);
    expect(useStagedPlanStore.getState().queues.tez.lastUnlockDay).toBeNull();
  });

  it('alışkanlık açılımı alışkanlığı oluşturup plana bağlar', async () => {
    markYesterday();
    useStagedPlanStore.getState().setQueue('tez', [habit]);
    await releaseStagedPlanItems();
    const ids = (usePrefsStore.getState() as any).tezPlanHabitIds as string[];
    expect(ids).toHaveLength(2);
    expect(useHabitStore.getState().habits.some(h => h.id === ids[1])).toBe(true);
  });

  it('alışkanlık sınırı doluyken sıradaki alışkanlık BEKLER, araya görev açılır (madde 6)', async () => {
    markYesterday();
    const full = Array.from({ length: 7 }, (_, i) => ({ id: i === 0 ? 'h1' : `x${i}`, name: `x${i}`, emoji: '', color: '#000', completedDates: i === 0 ? [yesterday] : [], createdAt: '' }));
    useHabitStore.setState({ habits: full as never });
    useStagedPlanStore.getState().setQueue('tez', [habit, task]);
    await releaseStagedPlanItems();
    expect(createTask).toHaveBeenCalledTimes(1);                       // görev açıldı
    expect(useStagedPlanStore.getState().queues.tez.items).toEqual([habit]); // alışkanlık sırada bekliyor
    expect(useHabitStore.getState().habits).toHaveLength(7);
  });

  it('sınır doluyken sırada yalnız alışkanlık varsa bugün açılım yok', async () => {
    markYesterday();
    const full = Array.from({ length: 7 }, (_, i) => ({ id: i === 0 ? 'h1' : `x${i}`, name: `x${i}`, emoji: '', color: '#000', completedDates: i === 0 ? [yesterday] : [], createdAt: '' }));
    useHabitStore.setState({ habits: full as never });
    useStagedPlanStore.getState().setQueue('tez', [habit]);
    await releaseStagedPlanItems();
    expect(useStagedPlanStore.getState().queues.tez.items).toHaveLength(1);
    expect(useStagedPlanStore.getState().queues.tez.lastUnlockDay).toBeNull();
  });

  it('mod kapatıldıysa sıra silinir', async () => {
    usePrefsStore.getState().setSeasonalPref('tezMode', false);
    usePrefsStore.getState().clearPlanIds('tez');
    useStagedPlanStore.getState().setQueue('tez', [task]);
    await releaseStagedPlanItems();
    expect(useStagedPlanStore.getState().queues.tez).toBeUndefined();
    expect(createTask).not.toHaveBeenCalled();
  });

  /*
    CİHAZDA YAKALANDI: kurulum önce kimlikleri temizler, sırayı yazar, sunucuyu bekler,
    kimlikleri EN SON yazar. Arada açılım çalışınca boş kimlikleri "plan kapandı" sanıp
    sırayı siliyordu — kalan 5 öğe sessizce kayboluyordu.
  */
  it('mod açık ama kimlikler henüz yazılmamışsa (kurulum sürüyor) sıra KORUNUR', async () => {
    usePrefsStore.getState().setSeasonalPref('tezMode', true);
    usePrefsStore.getState().clearPlanIds('tez');
    useStagedPlanStore.getState().setQueue('tez', [task, habit]);
    await releaseStagedPlanItems();
    expect(useStagedPlanStore.getState().queues.tez.items).toHaveLength(2);
    expect(createTask).not.toHaveBeenCalled();
  });
});

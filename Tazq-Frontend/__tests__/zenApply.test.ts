import { useTaskStore, type Task } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { patchTask } from '@/features/tasks/utils/taskActions';
import { applyRebalance } from '@/features/tasks/utils/rebalanceActions';
import { SOMEDAY_TAG, isSomeday } from '@/features/tasks/utils/taskTags';
import { calendarDayOf } from '@/shared/utils/dateKey';
import type { RebalancePlan } from '@/features/tasks/utils/taskBalancer';

const mockUpdate = jest.fn();
jest.mock('@/shared/services/api', () => ({
  TaskService: { updateTask: (...a: unknown[]) => mockUpdate(...a) },
}));
const mockCancel = jest.fn();
const mockSchedule = jest.fn();
jest.mock('@/shared/utils/notifications', () => ({
  cancelTaskNotification: (...a: unknown[]) => mockCancel(...a),
  scheduleTaskNotification: (...a: unknown[]) => mockSchedule(...a),
}));

/**
 * TAZQZen UYGULAMA YOLU — motorun kararını veriye yazan kısım.
 *
 * Motor (taskBalancer.test) doğru kararı verse bile, önceki hâlde yazma tarafı üç
 * yerden sızıyordu: geri alma yoktu, bildirimler eski günde çalıyordu ve rafa alınan
 * görevin asıl tarihi kalıcı olarak siliniyordu. Bunların hiçbiri gözle fark edilmez;
 * kullanıcı ancak ertesi sabah yanlış saatte çalan bir hatırlatıcıyla öğrenir.
 */

const ctx = { language: 'tr', hideNotificationContent: false };

const task = (id: number, extra: Partial<Task> = {}): Task => ({
  id, title: `g${id}`, description: '', isCompleted: false, priority: 'Medium',
  dueDate: '2026-09-10T00:00:00Z', dueTime: null, tags: [], ...extra,
} as Task);

const byId = (id: number) => useTaskStore.getState().tasks.find((t) => t.id === id)!;
const plan = (moves: RebalancePlan['moves']): RebalancePlan => ({
  moves, scheduled: moves.filter((m) => m.to).length, someday: moves.filter((m) => !m.to).length,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
  useOfflineQueue.setState({ ops: [] });
  useNetworkStore.setState({ isOnline: true });
});

describe('uygulama ve geri alma', () => {
  it('güne taşır, rafa alır — ve GERİ ALMA her şeyi eski hâline döndürür', async () => {
    const reminderTime = '2026-09-10T09:30:00.000Z';
    useTaskStore.setState({ tasks: [
      task(1, { tags: ['hatırlatıcı'], dueTime: reminderTime }),
      task(2, { tags: ['work'], dueTime: reminderTime }),
    ] });

    const applied = await applyRebalance(plan([
      { task: byId(1), to: '2026-09-21' },
      { task: byId(2), to: null },
    ]), ctx);

    expect(applied).toMatchObject({ moved: 2, scheduled: 1, someday: 1, failed: 0 });
    // Taşınan: yeni gün (yerel öğlen — her saat diliminde aynı gün), saat KORUNUR
    expect(calendarDayOf(byId(1).dueDate)).toBe('2026-09-21');
    expect(new Date(byId(1).dueDate!).getHours()).toBe(12);
    expect(byId(1).dueTime).toBe(reminderTime);
    // Rafa alınan: tarih ve saat temizlenir, etiket eklenir. Saat kalsaydı bildirim
    // sistemi tarihsiz görevin hatırlatıcısını BUGÜNE kurardı.
    expect(byId(2).dueDate).toBeNull();
    expect(byId(2).dueTime).toBeNull();
    expect(isSomeday(byId(2))).toBe(true);

    await applied.undo();
    expect(byId(1)).toMatchObject({ dueDate: '2026-09-10T00:00:00Z', dueTime: reminderTime, tags: ['hatırlatıcı'] });
    expect(byId(2)).toMatchObject({ dueDate: '2026-09-10T00:00:00Z', dueTime: reminderTime, tags: ['work'] });
  });

  it('geri alma BİR kez çalışır — ikinci dokunuş sonraki düzenlemeyi ezmez', async () => {
    useTaskStore.setState({ tasks: [task(1)] });
    const applied = await applyRebalance(plan([{ task: byId(1), to: '2026-09-21' }]), ctx);
    await applied.undo();
    await patchTask(1, { dueDate: '2026-09-25' }); // kullanıcı sonradan elle değiştirdi
    await applied.undo();
    expect(byId(1).dueDate).toBe('2026-09-25');
  });

  it('bildirim YENİ güne kurulur; rafa alınanınki yalnız iptal edilir', async () => {
    useTaskStore.setState({ tasks: [
      task(1, { tags: ['hatırlatıcı'] }),
      task(2, { tags: ['hatırlatıcı'] }),
    ] });
    await applyRebalance(plan([
      { task: byId(1), to: '2026-09-21' },
      { task: byId(2), to: null },
    ]), ctx);

    expect(mockCancel).toHaveBeenCalledWith(1);
    expect(mockCancel).toHaveBeenCalledWith(2);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0]).toBe(1);
    expect(calendarDayOf(mockSchedule.mock.calls[0][2])).toBe('2026-09-21');
  });

  it('plan hesaplandıktan SONRA tamamlanan görev taşınmaz', async () => {
    // Önizleme birkaç saniye önce çizildi; o arada kullanıcı görevi bitirdi.
    useTaskStore.setState({ tasks: [task(1)] });
    const stale = plan([{ task: byId(1), to: '2026-09-21' }]);
    useTaskStore.getState().updateTask(1, { isCompleted: true });

    const applied = await applyRebalance(stale, ctx);
    expect(applied.moved).toBe(0);
    expect(byId(1).dueDate).toBe('2026-09-10T00:00:00Z');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sunucu reddederse görev ESKİ hâline döner ve "taşındı" sayılmaz', async () => {
    useTaskStore.setState({ tasks: [task(1)] });
    mockUpdate.mockRejectedValue({ response: { status: 400 } });

    const applied = await applyRebalance(plan([{ task: byId(1), to: '2026-09-21' }]), ctx);
    expect(applied).toMatchObject({ moved: 0, failed: 1 });
    expect(byId(1).dueDate).toBe('2026-09-10T00:00:00Z');
  });
});

describe('patchTask — tek yazma yolu', () => {
  it('çevrimdışı: iyimser uygular ve YALNIZ değişen alanları kuyruğa alır', async () => {
    useNetworkStore.setState({ isOnline: false });
    useTaskStore.setState({ tasks: [task(1, { title: 'uzun başlık' })] });

    expect(await patchTask(1, { dueDate: '2026-09-21' })).toBe('queued');
    expect(byId(1).dueDate).toBe('2026-09-21');
    const op = useOfflineQueue.getState().ops[0] as { type: string; payload: Record<string, unknown> };
    expect(op.type).toBe('update-task');
    // Başlık yükte YOK: eşitleme dakikalar sonra olabilir, tam kopya aradaki
    // düzenlemenin üstüne yazardı.
    expect(op.payload).not.toHaveProperty('title');
  });

  it('ağ hatası kuyruğa düşer — değişiklik kaybolmaz', async () => {
    useTaskStore.setState({ tasks: [task(1)] });
    mockUpdate.mockRejectedValue(new Error('Network Error'));
    expect(await patchTask(1, { dueDate: '2026-09-21' })).toBe('queued');
    expect(byId(1).dueDate).toBe('2026-09-21');
    expect(useOfflineQueue.getState().ops).toHaveLength(1);
  });

  it('çevrimiçi istek TAM görev gönderir — sunucu her alanı yazıyor', async () => {
    useTaskStore.setState({ tasks: [task(1, { title: 'korunmalı', description: 'not' })] });
    await patchTask(1, { dueDate: '2026-09-21' });
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'korunmalı', description: 'not', dueDate: '2026-09-21',
    }));
  });

  it('rafa alınmış göreve TARİH verilince "belki bir gün" etiketi düşer', async () => {
    useTaskStore.setState({ tasks: [task(1, { dueDate: null, tags: ['work', SOMEDAY_TAG] })] });
    await patchTask(1, { dueDate: '2026-09-21' });
    expect(byId(1).tags).toEqual(['work']);
  });

  it('mağazada olmayan görev → dokunulmaz', async () => {
    useTaskStore.setState({ tasks: [] });
    expect(await patchTask(99, { dueDate: '2026-09-21' })).toBe('skipped');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

import { scheduleCommit, cancelCommit, flushCommits, __resetCommitsForTests, UNDO_WINDOW_MS } from '@/shared/utils/deferredCommit';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { completeTaskUndoable, doneToastText } from '@/features/tasks/utils/taskActions';
import { deletePaymentUndoable } from '@/features/payments/utils/paymentActions';
import { useToastStore } from '@/shared/store/useToastStore';

const mockUpdateTask = jest.fn();
const mockDeletePayment = jest.fn();
jest.mock('@/shared/services/api', () => ({
  TaskService: { updateTask: (...a: unknown[]) => mockUpdateTask(...a) },
  PaymentService: { deletePayment: (...a: unknown[]) => mockDeletePayment(...a) },
}));
jest.mock('@/shared/utils/notifications', () => ({ cancelTaskNotification: jest.fn() }));

const task = { id: 7, title: 'Rapor', isCompleted: false, tags: [] } as never;
const payment = { id: 3, title: 'Kira', amount: 100, dueDay: 5, recurrence: 'Monthly' } as never;
const flushPromises = () => new Promise((r) => jest.requireActual<typeof import('timers')>('timers').setImmediate(r));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUpdateTask.mockResolvedValue(undefined);
  mockDeletePayment.mockResolvedValue(undefined);
  __resetCommitsForTests();
  useNetworkStore.setState({ isOnline: true } as never);
  useOfflineQueue.setState({ ops: [] } as never);
  useTaskStore.setState({ tasks: [task] } as never);
  usePaymentsStore.setState({ payments: [payment] } as never);
});
afterEach(() => jest.useRealTimers());

describe('ertelenmiş gönderim', () => {
  it('süre dolunca gönderir, iptal edilirse göndermez', () => {
    const run = jest.fn();
    scheduleCommit('a', run);
    jest.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(cancelCommit('a')).toBe(false);

    const run2 = jest.fn();
    scheduleCommit('b', run2);
    expect(cancelCommit('b')).toBe(true);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(run2).not.toHaveBeenCalled();
  });

  it('arka plana geçişte bekleyenler hemen gider', () => {
    const run = jest.fn();
    scheduleCommit('a', run);
    expect(flushCommits()).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('görevde geri alma', () => {
  const done = () => useTaskStore.getState().tasks[0].isCompleted;

  it('görev hemen biter, sunucuya süre dolunca gider', () => {
    completeTaskUndoable(7);
    expect(done()).toBe(true);
    expect(mockUpdateTask).not.toHaveBeenCalled();
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockUpdateTask).toHaveBeenCalledWith(7, { isCompleted: true });
  });

  it('geri alınca sunucu hiç duymaz: tekrarlı görev yinelenmez', () => {
    const undo = completeTaskUndoable(7);
    expect(undo?.()).toBe(true);
    expect(done()).toBe(false);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('art arda iki görevde her geri alma kendi görevini döndürür', () => {
    useTaskStore.setState({ tasks: [task, { ...(task as object), id: 8 }] } as never);
    const undo7 = completeTaskUndoable(7);
    completeTaskUndoable(8);
    undo7?.();
    const byId = (id: number) => useTaskStore.getState().tasks.find((t) => t.id === id)?.isCompleted;
    expect(byId(7)).toBe(false);
    expect(byId(8)).toBe(true);
  });

  it('çevrimdışıysa süre dolunca kuyruğa girer; geri alınırsa girmez', async () => {
    useNetworkStore.setState({ isOnline: false } as never);
    const undo = completeTaskUndoable(7);
    expect(useOfflineQueue.getState().ops).toHaveLength(0);
    undo?.();
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(useOfflineQueue.getState().ops).toHaveLength(0);
    completeTaskUndoable(7);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(useOfflineQueue.getState().ops).toHaveLength(1);
  });

  it('süre geçtikten sonra geri alma etkisiz', () => {
    const undo = completeTaskUndoable(7);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(undo?.()).toBe(false);
    expect(done()).toBe(true);
  });

  it('zaten bitmiş görevde bir şey yapmaz', () => {
    useTaskStore.setState({ tasks: [{ ...(task as object), isCompleted: true }] } as never);
    expect(completeTaskUndoable(7)).toBeNull();
  });
});

describe('geri alma metni', () => {
  it('uzun başlık kısalır', () => {
    expect(doneToastText({ title: 'x'.repeat(50) } as never, 'tr').length).toBeLessThan(40);
    expect(doneToastText({ title: 'Rapor' } as never, 'tr')).toBe('Bitti · Rapor');
  });
  it('tekrarlı görev sonraki tarihi söyler', () => {
    const text = doneToastText({ title: 'Kira', recurrence: 'Monthly', dueDate: '2026-11-06' } as never, 'tr');
    expect(text).toContain('sonraki');
    expect(text).toContain('6 Ara');
  });
});

describe('ödeme silmede geri alma', () => {
  const list = () => usePaymentsStore.getState().payments;

  it('hemen gizlenir, süre dolunca silinir', () => {
    deletePaymentUndoable(3);
    expect(list()).toHaveLength(0);
    expect(mockDeletePayment).not.toHaveBeenCalled();
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockDeletePayment).toHaveBeenCalledWith(3);
  });

  it('geri alınca aynen döner, sunucu hiç duymaz', () => {
    const undo = deletePaymentUndoable(3);
    expect(undo?.()).toBe(true);
    expect(list()).toHaveLength(1);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockDeletePayment).not.toHaveBeenCalled();
  });

  it('sunucu reddederse ödeme geri gelir', async () => {
    jest.useRealTimers();
    mockDeletePayment.mockRejectedValue({ response: { status: 400 } });
    deletePaymentUndoable(3);
    flushCommits();
    await flushPromises();
    expect(list()).toHaveLength(1);
  });

  it('çevrimdışıysa kuyruğa girer', () => {
    useNetworkStore.setState({ isOnline: false } as never);
    deletePaymentUndoable(3);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(useOfflineQueue.getState().ops[0]).toMatchObject({ type: 'delete-payment', id: 3 });
  });
});

describe('bildirim süresi', () => {
  it('eylemli bildirim geri alma süresince kalır, eylemsiz 4 sn', () => {
    useToastStore.getState().show('x', 'info', { label: 'Geri al', onAction: () => {} });
    jest.advanceTimersByTime(4000);
    expect(useToastStore.getState().visible).toBe(true);
    jest.advanceTimersByTime(UNDO_WINDOW_MS - 4000);
    expect(useToastStore.getState().visible).toBe(false);
    useToastStore.getState().show('y');
    jest.advanceTimersByTime(4000);
    expect(useToastStore.getState().visible).toBe(false);
  });
});

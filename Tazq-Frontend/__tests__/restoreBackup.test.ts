import { parseBackup, planSize, type CurrentData } from '@/features/user/utils/restoreBackup';
import { applyRestorePlan } from '@/features/user/utils/applyRestore';
import { buildExportPackage } from '@/shared/utils/exportPackage';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useSessionStore } from '@/shared/store/useSessionStore';

const mockCreateTask = jest.fn();
const mockCreatePayment = jest.fn();
jest.mock('@/shared/services/api', () => ({
  ...jest.requireActual('@/shared/services/api'),
  TaskService: { createTask: (...a: unknown[]) => mockCreateTask(...a) },
  PaymentService: { createPayment: (...a: unknown[]) => mockCreatePayment(...a) },
}));

const empty: CurrentData = { tasks: [], habits: [], payments: [] };
const pkg = (over: object = {}) => JSON.stringify({ format: 'tazq-export', formatVersion: 1, tasks: [], habits: [], payments: [], ...over });
const planOf = (content: string, current = empty) => {
  const r = parseBackup(content, current);
  if (!r.ok) throw new Error('format');
  return r.plan;
};

describe('yedek dosyasını okuma', () => {
  it('bizim dosyamız değilse reddeder', () => {
    expect(parseBackup('{bozuk', empty)).toEqual({ ok: false, reason: 'format' });
    expect(parseBackup('[]', empty).ok).toBe(false);
    expect(parseBackup('{"format":"baska"}', empty).ok).toBe(false);
    expect(parseBackup('# Markdown yedek', empty).ok).toBe(false);
  });

  it('kendi dışa aktarmamızı geri okur', () => {
    const exported = buildExportPackage({
      language: 'tr',
      tasks: [{ id: 1, title: 'Rapor', description: 'not', dueDate: '2026-11-08T00:00:00', priority: 'High', isCompleted: false, recurrence: 'Weekly', tags: [], subtasks: [{ text: 'ilk', done: true }] }],
      habits: [{ id: 'h', name: 'Koşu', completedDates: ['2026-11-01'], skippedDates: ['2026-11-02'], createdAt: '2026-10-01T00:00:00Z' }],
      payments: [{ id: 2, title: 'Kira', amount: 12000, dueDay: 5, recurrence: 'Monthly' }],
    } as never, { localizeTitle: (t: { title: string }) => t.title, visibleTags: () => [], isSomeday: () => false } as never);
    const plan = planOf(JSON.stringify(exported));
    expect(plan.tasks[0].payload).toMatchObject({ title: 'Rapor', description: 'not', priority: 'High', recurrence: 'Weekly', isCompleted: false, subtasks: [{ text: 'ilk', done: true }] });
    expect(plan.habits[0]).toEqual({ name: 'Koşu', doneOn: ['2026-11-01'], restDays: ['2026-11-02'] });
    expect(plan.payments[0]).toMatchObject({ title: 'Kira', amount: 12000, dueDay: 5, recurrence: 'Monthly' });
  });

  it('var olanı tekrar eklemez, üstüne yazmaz; aynı dosyanın içindeki kopyayı da', () => {
    const plan = planOf(pkg({
      tasks: [{ title: 'RAPOR', dueDate: '2026-11-08' }, { title: 'Rapor', dueDate: '2026-11-09' }, { title: 'Yeni' }, { title: 'yeni' }],
      habits: [{ name: 'koşu' }, { name: 'Yüzme' }],
      payments: [{ title: 'Kira', amount: 100, dayOfMonth: 5 }, { title: 'Kira', amount: 200, dayOfMonth: 5 }],
    }), {
      tasks: [{ title: 'Rapor', dueDate: '2026-11-08T00:00:00' }],
      habits: [{ name: 'Koşu' }],
      payments: [{ title: 'Kira', amount: 100 }],
    });
    expect(plan.tasks.map((t) => t.payload.title)).toEqual(['Rapor', 'Yeni']);
    expect(plan.habits.map((h) => h.name)).toEqual(['Yüzme']);
    expect(plan.payments.map((p) => p.amount)).toEqual([200]);
    expect(plan.skipped).toBe(4);
  });

  it('dışarıdan gelen bozuk alanları kabul etmez', () => {
    const plan = planOf(pkg({
      tasks: [{ title: 5 }, null, { title: 'x'.repeat(900), dueDate: '<script>', dueTime: 'gece', priority: 'acil', repeat: 'hourly', subtasks: 'yok', tags: [1, 'iş'] }],
      habits: [{ name: 'Koşu', doneOn: ['dün', '2026-11-01'] }],
      payments: [{ title: 'A', amount: -1, dayOfMonth: 5 }, { title: 'B', amount: 'çok', dayOfMonth: 5 }, { title: 'C', amount: 1, dayOfMonth: 40 }],
    }));
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].payload).toMatchObject({ dueDate: null, dueTime: null, priority: 'Medium', recurrence: 'None', tags: ['iş'] });
    expect(plan.tasks[0].payload.title.length).toBeLessThanOrEqual(500);
    expect(plan.habits[0].doneOn).toEqual(['2026-11-01']);
    expect(plan.payments).toHaveLength(0);
    expect(plan.skipped).toBe(5);
  });

  it('biten tekrarlı görev yeni tekrar başlatmaz; arşiv ve raf durumu korunur', () => {
    const plan = planOf(pkg({ tasks: [{ title: 'A', status: 'completed', repeat: 'monthly', archived: true, someday: true }] }));
    expect(plan.tasks[0].payload).toMatchObject({ isCompleted: true, recurrence: 'None', tags: ['archived', 'someday'] });
  });

  it('boş plan sayılır', () => {
    expect(planSize(planOf(pkg()))).toBe(0);
  });
});

describe('planı yazma', () => {
  const content = pkg({
    tasks: [{ title: 'A' }, { title: 'B' }],
    habits: [{ name: 'Koşu', doneOn: ['2026-11-01'], restDays: ['2026-11-02'] }],
    payments: [{ title: 'Kira', amount: 100, dayOfMonth: 5 }],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTask.mockImplementation(async (p: object) => ({ ...p, id: 50 + mockCreateTask.mock.calls.length }));
    mockCreatePayment.mockImplementation(async (p: object) => ({ ...p, id: 90 }));
    useNetworkStore.setState({ isOnline: true } as never);
    useOfflineQueue.setState({ ops: [] } as never);
    useSessionStore.setState({ isGuest: false } as never);
    useTaskStore.setState({ tasks: [] } as never);
    useHabitStore.setState({ habits: [] } as never);
    usePaymentsStore.setState({ payments: [] });
  });

  it('çevrimiçi: sunucuya yazar, alışkanlık geçmişiyle gelir, var olana dokunmaz', async () => {
    useTaskStore.setState({ tasks: [{ id: 1, title: 'Eski', tags: [] }] } as never);
    const res = await applyRestorePlan(planOf(content));
    expect(res).toEqual({ added: 4, failed: 0 });
    expect(useTaskStore.getState().tasks.map((t) => t.title).sort()).toEqual(['A', 'B', 'Eski']);
    expect(useHabitStore.getState().habits[0]).toMatchObject({ name: 'Koşu', completedDates: ['2026-11-01'], skippedDates: ['2026-11-02'] });
    expect(usePaymentsStore.getState().payments.map((p) => p.title)).toEqual(['Kira']);
  });

  it('her görev kendi anahtarıyla gider; çevrimdışıysa kuyruğa, kimlikler çakışmaz', async () => {
    useNetworkStore.setState({ isOnline: false } as never);
    await applyRestorePlan(planOf(content));
    expect(mockCreateTask).not.toHaveBeenCalled();
    const ops = useOfflineQueue.getState().ops.filter((o) => o.type === 'create-task') as unknown as { tempId: number; payload: { clientKey: string } }[];
    expect(ops).toHaveLength(2);
    expect(ops[0].tempId).not.toBe(ops[1].tempId);
    expect(ops[0].payload.clientKey).not.toBe(ops[1].payload.clientKey);
  });

  it('misafirde sunucuya gitmez, kuyrukta bekler', async () => {
    useSessionStore.setState({ isGuest: true } as never);
    const res = await applyRestorePlan(planOf(pkg({ tasks: [{ title: 'A' }] })));
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(res.added).toBe(1);
    expect(useOfflineQueue.getState().ops).toHaveLength(1);
  });

  it('reddedilen sayılır, kalanlar eklenir', async () => {
    mockCreateTask.mockRejectedValueOnce({ response: { status: 429 } });
    const res = await applyRestorePlan(planOf(content));
    expect(res).toEqual({ added: 3, failed: 1 });
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['B']);
  });
});

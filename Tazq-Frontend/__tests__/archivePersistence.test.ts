import { useTaskStore, type Task } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { archiveTask, restoreTask } from '@/features/tasks/utils/taskActions';
import { ARCHIVED_TAG, withArchived, isInternalTag, visibleTextTags } from '@/features/tasks/utils/taskTags';

const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/shared/services/api', () => ({
  TaskService: {
    updateTask: (...a: unknown[]) => mockUpdate(...a),
    deleteTask: (...a: unknown[]) => mockDelete(...a),
  },
}));
const mockCancel = jest.fn();
jest.mock('@/shared/utils/notifications', () => ({
  cancelTaskNotification: (...a: unknown[]) => mockCancel(...a),
}));

/**
 * ARŞİV KALICI OLMALI — ve HİÇBİR ŞEY SİLMEMELİ.
 *
 * Eskiden arşiv yalnız telefondaki bir bayraktı (`isArchived`); sunucuda böyle bir alan
 * yok. Uygulama açılışta görevleri sunucudan tazeleyince bayrak siliniyor, arşivlenen
 * görev sessizce listeye geri dönüyordu. Artık arşiv görevin ETİKETİNDE yaşıyor.
 */

const task = (id: number, extra: Partial<Task> = {}): Task => ({
  id, title: `g${id}`, description: '', isCompleted: false, priority: 'Medium',
  dueDate: '2026-09-25T00:00:00Z', tags: [], ...extra,
} as Task);
const byId = (id: number) => useTaskStore.getState().tasks.find((t) => t.id === id)!;

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
  useOfflineQueue.setState({ ops: [] });
  useNetworkStore.setState({ isOnline: true } as never);
  useTaskStore.getState().setTasks([
    task(1, { tags: ['iş', 'hatırlatıcı'], recurrence: 'Monthly' }),
    task(2),
  ]);
});

describe('arşivle', () => {
  it('etiket eklenir, görev listeden çıkar, sunucuya ETİKETLE yazılır', () => {
    archiveTask(1);
    expect(byId(1).isArchived).toBe(true);
    expect(byId(1).tags).toEqual([ARCHIVED_TAG, 'iş', 'hatırlatıcı']);
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ tags: [ARCHIVED_TAG, 'iş', 'hatırlatıcı'] }));
  });

  it('HİÇBİR ŞEY SİLİNMEZ — görev, tarihi, tekrarı ve etiketleri yerinde', () => {
    archiveTask(1);
    expect(useTaskStore.getState().tasks).toHaveLength(2);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(byId(1)).toMatchObject({ dueDate: '2026-09-25T00:00:00Z', recurrence: 'Monthly', title: 'g1' });
  });

  it('hatırlatıcısı iptal edilir — görünmeyen iş gece çalmasın', () => {
    archiveTask(1);
    expect(mockCancel).toHaveBeenCalledWith(1);
  });

  it('çevrimdışıyken kuyruğa düşer; kuyruktaki kayıt etiketi taşır', () => {
    useNetworkStore.setState({ isOnline: false } as never);
    archiveTask(1);
    expect(mockUpdate).not.toHaveBeenCalled();
    const ops = useOfflineQueue.getState().ops as unknown as { payload: { tags: string[] } }[];
    expect(ops).toHaveLength(1);
    expect(ops[0].payload.tags[0]).toBe(ARCHIVED_TAG);
  });
});

describe('sunucudan tazeleme arşivi BOZMAZ (asıl hata)', () => {
  it('sunucu etiketli görevi döndürünce görev arşivde KALIR', () => {
    archiveTask(1);
    // Sunucunun bilmediği `isArchived` alanı YOK; yalnız etiketler var.
    useTaskStore.getState().setTasks([task(1, { tags: [ARCHIVED_TAG, 'iş'] }), task(2)]);
    expect(byId(1).isArchived).toBe(true);
  });

  it('başka cihazda geri alınmışsa (etiket yok) burada da geri gelir', () => {
    archiveTask(1);
    useTaskStore.getState().setTasks([task(1, { tags: ['iş'] }), task(2)]);
    expect(byId(1).isArchived).toBe(false);
  });
});

describe('geri al', () => {
  it('etiket kalkar, diğer etiketler aynen durur, sunucuya yazılır', () => {
    archiveTask(1);
    restoreTask(1);
    expect(byId(1).isArchived).toBe(false);
    expect(byId(1).tags).toEqual(['iş', 'hatırlatıcı']);
    expect(mockUpdate).toHaveBeenLastCalledWith(1, expect.objectContaining({ tags: ['iş', 'hatırlatıcı'] }));
  });
});

describe('etiket kuralları', () => {
  it('arşiv etiketi kullanıcıya hiçbir yerde görünmez', () => {
    expect(isInternalTag(ARCHIVED_TAG)).toBe(true);
    expect(visibleTextTags([ARCHIVED_TAG, 'iş'])).toEqual(['iş']);
  });

  it('başa konur — sunucunun 8 etiket sınırı arşiv bilgisini KESEMEZ', () => {
    const full = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(withArchived(full, true).slice(0, 8)).toContain(ARCHIVED_TAG);
  });

  it('iki kez arşivlemek etiketi çoğaltmaz', () => {
    expect(withArchived([ARCHIVED_TAG, 'iş'], true)).toEqual([ARCHIVED_TAG, 'iş']);
  });
});

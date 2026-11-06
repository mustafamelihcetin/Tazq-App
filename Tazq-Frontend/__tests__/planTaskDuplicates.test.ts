/**
 * AYNI PLAN GÖREVİ BİR KEZ (2026-11-06, cihazda: KPSS 2. gün, 9 adet "Eğitim Bilimleri kaynak kitap temin et").
 * Kademeli açılım anahtarsız gidiyor ve aynı anda birden çok çalışabiliyordu; temizlik de çevrilmiş etiketi plan görevi saymıyordu.
 */
import { releaseStagedPlanItems } from '@/features/modes/utils/stagedRollout';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { duplicatePlanTasks } from '@/features/modes/utils/planTaskOps';
import { EXAM_CONTENT } from '@/features/modes/utils/examContent';
import { withPlanKey } from '@/shared/utils/planKey';
import { api, TaskService } from '@/shared/services/api';

const createTask = jest.spyOn(TaskService, 'createTask');
const yesterday = fmtDateKey(new Date(Date.now() - 86400000));
const TODAY = '2026-11-06';
const NOW = new Date(2026, 10, 6, 12);
const keyOf = (p: { title: string; description: string; dueDate?: string; tags: string[]; clientKey?: string }) => withPlanKey(p);
const JSON_DESC = JSON.stringify({ tr: 'Eğitim Bilimleri kaynak kitap temin et', en: 'Get a book' });

const staged = (slot: string) => ({
  kind: 'task' as const,
  item: { titleTr: 'Eğitim Bilimleri kaynak kitap temin et', titleEn: 'Get an Education Sciences book', priority: 'High', tags: [slot, 'exam'] },
});
const SLOTS: [string, string][] = [
  ['exam', 'examMode'], ['exam2', 'examMode'], ['tez', 'tezMode'], ['mulakat', 'mulakatMode'], ['spor', 'sporMode'],
  ['ramazan', 'ramazan'], ['tasarruf', 'tasarrufMode'], ['birakma', 'birakmaMode'],
];

function setup(slot: string, pref: string) {
  useStagedPlanStore.getState().reset();
  useTaskStore.setState({ tasks: [] });
  useHabitStore.setState({ habits: [{ id: 'h1', name: 'Çalışma', emoji: 'x', color: '#000', completedDates: [yesterday], createdAt: '' }] } as never);
  usePrefsStore.getState().setPlanIds(slot as never, ['h1'], []);
  usePrefsStore.getState().setSeasonalPref(pref as never, true as never);
  useStagedPlanStore.getState().setQueue(slot, [staged(slot)]);
}

beforeEach(() => {
  createTask.mockReset();
  createTask.mockResolvedValue({ id: 99 } as never);
});

describe('kademeli açılım, tüm modlar', () => {
  it.each(SLOTS)('%s: aynı anda dokuz kez çalışsa da tek görev', async (slot, pref) => {
    setup(slot, pref);
    await Promise.all(Array.from({ length: 9 }, () => releaseStagedPlanItems()));
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useStagedPlanStore.getState().queues[slot].items).toHaveLength(0);
  });

  it.each(SLOTS)('%s: yanıt gelmeyip yeniden denenirse anahtar aynı, sunucu tekrar oluşturmaz', async (slot, pref) => {
    setup(slot, pref);
    createTask.mockRejectedValueOnce(new Error('timeout'));
    await releaseStagedPlanItems();
    await releaseStagedPlanItems();
    const [first, second] = createTask.mock.calls.map((c) => (c[0] as { clientKey?: string }).clientKey);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('görev listede zaten açıksa yenisi oluşturulmaz, plana bağlanır', async () => {
    setup('exam', 'examMode');
    useTaskStore.setState({ tasks: [{ id: 40, title: 'Eğitim Bilimleri kaynak kitap temin et', isCompleted: false, tags: ['sınav'] }] } as never);
    await releaseStagedPlanItems();
    expect(createTask).not.toHaveBeenCalled();
    expect((usePrefsStore.getState() as unknown as { examPlanTaskIds: number[] }).examPlanTaskIds).toContain(40);
    expect(useStagedPlanStore.getState().queues.exam.items).toHaveLength(0);
  });

  it('yeni görev mod etiketini çevrilmiş halde kaybetmez', async () => {
    setup('exam', 'examMode');
    await releaseStagedPlanItems();
    expect((createTask.mock.calls[0][0] as { tags: string[] }).tags).toContain('exam');
  });
});

describe('sunucu çağrısı', () => {
  it('aynı anahtarlı eş zamanlı istekler tek isteğe iner', async () => {
    createTask.mockRestore();
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { id: 5 } } as never);
    const payload = { title: 'A', description: '', isCompleted: false, priority: 'Low', tags: [], clientKey: 'k1' } as never;
    const results = await Promise.all([TaskService.createTask(payload), TaskService.createTask(payload)]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ id: 5 }, { id: 5 }]);
    await TaskService.createTask(payload);
    expect(post).toHaveBeenCalledTimes(2);
    post.mockRestore();
  });

  it('plan görevine anahtar kendiliğinden eklenir, kullanıcınınkine eklenmez', () => {
    const plan = keyOf({ title: 'A', description: JSON_DESC, dueDate: TODAY, tags: ['sınav'] });
    expect(plan.clientKey).toBeTruthy();
    expect(keyOf({ title: 'A', description: JSON_DESC, dueDate: TODAY, tags: ['sınav'] }).clientKey).toBe(plan.clientKey);
    expect(keyOf({ title: 'A', description: '', tags: ['tez'] }).clientKey).toBeTruthy();
    expect(keyOf({ title: 'Süt al', description: 'market', tags: ['ev'] }).clientKey).toBeUndefined();
    expect(keyOf({ title: 'A', description: JSON_DESC, tags: [], clientKey: 'benim' }).clientKey).toBe('benim');
  });
});

describe('var olan kopyaların temizliği', () => {
  const copy = (id: number, over: object = {}) => ({ id, title: 'Eğitim Bilimleri kaynak kitap temin et', description: JSON_DESC, dueDate: `${TODAY}T00:00:00`, isCompleted: false, tags: ['sınav', 'eğitim'], ...over });
  const ids = (list: { id: number }[]) => list.map((t) => t.id).sort((a, b) => a - b);

  it('çevrilmiş etiketli 9 kopyadan biri kalır', () => {
    const tasks = Array.from({ length: 9 }, (_, i) => copy(i + 1));
    expect(duplicatePlanTasks(tasks, NOW)).toHaveLength(8);
  });

  it('tamamlanmış olan korunur', () => {
    const removed = duplicatePlanTasks([copy(1), copy(2, { isCompleted: true }), copy(3)], NOW);
    expect(ids(removed)).toEqual([1, 3]);
  });

  it('başka günün aynı adlı görevi kopya değildir', () => {
    expect(duplicatePlanTasks([copy(1), copy(2, { dueDate: '2026-11-07T00:00:00' })], NOW)).toHaveLength(0);
  });

  it('süresi geçmiş eski örnek, güncel örnek varken fazlalıktır', () => {
    const removed = duplicatePlanTasks([copy(1, { dueDate: '2026-11-02T00:00:00' }), copy(2)], NOW);
    expect(ids(removed)).toEqual([1]);
  });

  it('güncel örnek yoksa gecikmiş görev kalır', () => {
    expect(duplicatePlanTasks([copy(1, { dueDate: '2026-11-02T00:00:00' })], NOW)).toHaveLength(0);
  });

  it('kullanıcının kendi gecikmiş görevi silinmez, aynı adda yenisi olsa da', () => {
    const mine = (id: number, dueDate: string) => ({ id, title: 'Kitap al', description: '', dueDate, isCompleted: false, tags: ['sınav'] });
    expect(duplicatePlanTasks([mine(1, '2026-11-02T00:00:00'), mine(2, `${TODAY}T00:00:00`)], NOW)).toHaveLength(0);
  });

  it('kullanıcının kendi görevine dokunmaz, etiketi aynı olsa da', () => {
    const mine = (id: number) => ({ id, title: 'Kitap al', description: '', dueDate: `${TODAY}T00:00:00`, isCompleted: false, tags: ['sınav'] });
    expect(duplicatePlanTasks([mine(1), mine(2)], NOW)).toHaveLength(0);
  });

  it('ham etiketli plan görevleri eskisi gibi yakalanır', () => {
    const raw = (id: number) => ({ id, title: 'Tez: Kaynak', description: '', dueDate: `${TODAY}T00:00:00`, isCompleted: false, tags: ['tez'] });
    expect(duplicatePlanTasks([raw(1), raw(2)], NOW)).toHaveLength(1);
  });
});

describe('içerik', () => {
  it('hiçbir sınav içeriğinde aynı görev iki kez yazılı değil', () => {
    for (const [name, c] of Object.entries(EXAM_CONTENT)) {
      const titles = [...c.setupTasks, ...c.sprintTasks].map((t) => t.titleTr.trim().toLocaleLowerCase('tr'));
      expect({ name, dup: titles.filter((t, i) => titles.indexOf(t) !== i) }).toEqual({ name, dup: [] });
    }
  });
});

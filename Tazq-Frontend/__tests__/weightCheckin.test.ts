import fs from 'fs';
import path from 'path';
/**
 * Haftalık tartım akışı — regresyon testleri.
 *
 * Kök nedenler (giderildi):
 *  1. `recordWeeklyWeight` yalnız listedeki İLK açık tartım görevini kapatıyordu →
 *     birden fazla açık görev varsa kullanıcının BASTIĞI görev açık kalıyordu
 *     ("kilo kaydedildi ama görev işaretlenmedi").
 *  2. Kilo son 7 günde zaten girilmişse görev hiçbir yoldan kapatılamıyordu
 *     (dokunmak modalı açıyor, modal reddediyordu) → "işaretleyemedim".
 */
jest.mock('@/shared/services/api', () => ({
  TaskService: {
    createTask: jest.fn(async (p: any) => ({ ...p, id: Math.floor(Math.random() * 1e6) + 1 })),
    updateTask: jest.fn(async () => ({})),
    deleteTask: jest.fn(async () => ({})),
  },
}));

import {
  canLogWeight,
  daysSinceLastWeight,
  daysUntilNextWeight,
  isWeightEntryTask,
  findOpenWeightTasks,
  weightTaskAction,
  recordWeeklyWeight,
  completeTaskOfflineFirst,
} from '@/features/modes/utils/weightCheckin';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

const ymd = (offsetDays: number) => {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mkTask = (id: number, title: string, tags: string[]) => ({
  id, title, description: '', dueDate: ymd(-9), isCompleted: false,
  priority: 'Medium' as const, tags,
});

// useLanguageStore hidrasyonu 200 ms sonra dil senkronu tetikliyor; suite ondan önce
// biterse Jest "environment torn down" uyarısı basıyor. Timer'ın boşalmasını bekle.
afterAll(() => new Promise(res => setTimeout(res, 300)));

beforeEach(() => {
  useTaskStore.setState({ tasks: [] });
  useSporStore.setState({ weightLog: [] });
  useNetworkStore.setState({ isOnline: true } as any);
  useOfflineQueue.setState({ ops: [] } as any);
});

describe('kadans yardımcıları', () => {
  it('kayıt yoksa girilebilir', () => {
    expect(canLogWeight([])).toBe(true);
    expect(daysSinceLastWeight([])).toBeNull();
    expect(daysUntilNextWeight([])).toBe(0);
  });
  it('7 gün dolmadan girilemez, dolunca girilebilir', () => {
    expect(canLogWeight([{ date: ymd(-3) }])).toBe(false);
    expect(daysUntilNextWeight([{ date: ymd(-3) }])).toBe(4);
    expect(canLogWeight([{ date: ymd(-7) }])).toBe(true);
    expect(daysUntilNextWeight([{ date: ymd(-7) }])).toBe(0);
  });
});

describe('isWeightEntryTask', () => {
  it('etiketten ve eski başlıklardan tanır', () => {
    expect(isWeightEntryTask({ tags: ['weight_entry', 'spor'] })).toBe(true);
    expect(isWeightEntryTask({ title: 'Güncel kilonu gir' })).toBe(true);
    expect(isWeightEntryTask({ title: 'Log current weight' })).toBe(true);
    expect(isWeightEntryTask({ title: 'Bugün 30 dk yürü', tags: ['spor'] })).toBe(false);
    expect(isWeightEntryTask(null)).toBe(false);
  });
});

describe('weightTaskAction', () => {
  it('tartım vakti gelmişse modalı açar', () => {
    useSporStore.setState({ weightLog: [{ date: ymd(-8), weight: 90 }] });
    expect(weightTaskAction()).toBe('log');
  });
  it('kilo zaten girilmişse görevi doğrudan tamamlar', () => {
    useSporStore.setState({ weightLog: [{ date: ymd(-2), weight: 90 }] });
    expect(weightTaskAction()).toBe('complete');
  });
});

describe('recordWeeklyWeight', () => {
  it('AÇIK OLAN TÜM tartım görevlerini kapatır', () => {
    // Eskiden yalnız ilki kapanıyordu; kullanıcının bastığı görev açık kalıyordu.
    useTaskStore.setState({ tasks: [
      mkTask(11, 'Haftalık tartım zamanı', ['weight_entry']),
      mkTask(12, 'Güncel kilonu gir', ['weight_entry', 'spor']),
      mkTask(13, 'Bugün 30 dk yürü', ['spor', 'daily']),
    ] as any });

    return recordWeeklyWeight(85, 'tr', 12).then(ok => {
      expect(ok).toBe(true);
      const byId = (id: number) => useTaskStore.getState().tasks.find(t => t.id === id);
      expect(byId(11)!.isCompleted).toBe(true);
      expect(byId(12)!.isCompleted).toBe(true); // basılan görev
      expect(byId(13)!.isCompleted).toBe(false); // alakasız görev dokunulmamış
      expect(useSporStore.getState().weightLog[0].weight).toBe(85);
    });
  });

  it('7 gün dolmadıysa reddeder ve hiçbir şeyi değiştirmez', async () => {
    useSporStore.setState({ weightLog: [{ date: ymd(-2), weight: 90 }] });
    useTaskStore.setState({ tasks: [mkTask(21, 'Güncel kilonu gir', ['weight_entry', 'spor'])] as any });

    const ok = await recordWeeklyWeight(85, 'tr', 21);
    expect(ok).toBe(false);
    expect(useTaskStore.getState().tasks.find(t => t.id === 21)!.isCompleted).toBe(false);
    expect(useSporStore.getState().weightLog).toHaveLength(1);
  });

  it('kaydettikten sonra bir sonraki haftalık görevi planlar', async () => {
    useTaskStore.setState({ tasks: [mkTask(31, 'Güncel kilonu gir', ['weight_entry', 'spor'])] as any });
    await recordWeeklyWeight(85, 'tr', 31);
    const open = findOpenWeightTasks();
    expect(open).toHaveLength(1);       // tam olarak 1 açık görev kalır
    expect(open[0]).not.toBe(31);       // yeni görev (eskisi kapandı)
  });
});

describe('completeTaskOfflineFirst', () => {
  it('çevrimdışıyken kuyruğa alır', () => {
    useNetworkStore.setState({ isOnline: false } as any);
    useTaskStore.setState({ tasks: [mkTask(41, 'Güncel kilonu gir', ['weight_entry', 'spor'])] as any });

    completeTaskOfflineFirst(41);

    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
    const q = useOfflineQueue.getState().ops as any[];
    expect(q.some(i => i.type === 'toggle-task' && i.id === 41 && i.isCompleted === true)).toBe(true);
  });

  it('zaten tamamlanmış görevi tekrar toggle etmez', () => {
    useTaskStore.setState({ tasks: [{ ...mkTask(51, 'Güncel kilonu gir', ['weight_entry']), isCompleted: true }] as any });
    completeTaskOfflineFirst(51);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
  });
});

/**
 * ZİNCİR KOPMASI ONARIMI.
 *
 * Haftalık tartım, kendi kendini zincirleyen TEK plan görevi: her kayıttan sonra bir
 * sonraki (+7 gün) oluşturuluyor. Diğer plan görevlerini günlük motor her gün yeniden
 * ürettiği için onlar kendiliğinden iyileşiyor; bu zincirin tek bir halkası var.
 *
 * `ensureWeeklyWeightTask` yalnız iki yerden çağrılıyordu — tartım kaydedilince ve plan
 * ilk kurulunca. Kullanıcı açık tartım görevini silerse ikisi de bir daha tetiklenmiyor
 * ve haftalık tartım KALICI OLARAK duruyordu. Kullanıcı bunu hata olarak da algılamıyor,
 * "artık sormuyor" diye düşünüyor — sessiz bozulmanın tanımı.
 */
describe('tartım zinciri kendini onarır', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'features/modes/hooks/usePlanAdaptations.ts'), 'utf8');

  it('açık tartım görevi YOKSA yenisi kurulur', () => {
    expect(src).toContain('} else if (openWeightTasks.length === 0) {');
    expect(src).toContain('ensureWeeklyWeightTask(due, lang)');
  });

  it('onarım her açılışta çalışır — günlük üretim kapısının ÖNÜNDE', () => {
    // Kapının arkasında olsaydı onarım günde bir kez denenir, silinen görev
    // ertesi güne kadar geri gelmezdi.
    const repair = src.indexOf('openWeightTasks.length === 0');
    const gate = src.indexOf('ÜRETIM KAPISI');
    expect(repair).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(-1);
    expect(repair).toBeLessThan(gate);
  });

  it('onarım KADANSA saygılı — vakti gelmediyse ileri tarihe kurar', () => {
    // Bugüne kurulsaydı kullanıcı 7 gün dolmadan tartım görevini görür, açar ve
    // "7 günde bir girilir" duvarına toslardı.
    const i = src.indexOf('openWeightTasks.length === 0');
    const j = src.indexOf('ensureWeeklyWeightTask(due, lang)', i);
    const block = i > -1 && j > i ? src.slice(i, j) : '';
    expect(block).toContain('canLogWeight(log)');
    expect(block).toContain('daysUntilNextWeight(log)');
  });

  it('onarım BEKLENMİYOR — açılış ağ isteğine bağlanmaz', () => {
    // `await` edilseydi çevrimdışı/yavaş ağda uygulama açılışı gecikirdi.
    expect(src).toMatch(/ensureWeeklyWeightTask\(due, lang\)\.catch\(/);
    expect(src).not.toMatch(/await ensureWeeklyWeightTask\(due/);
  });

  it('kilo modu KAPALIYKEN görev üretmez', () => {
    // Onarım `isKiloActive` dalının içinde olmalı; dışarıda olsaydı modu kapatan
    // kullanıcıya sonsuza kadar tartım görevi üretilirdi.
    const off = src.indexOf('if (!isKiloActive) {');
    const repair = src.indexOf('openWeightTasks.length === 0');
    expect(off).toBeGreaterThan(-1);
    expect(off).toBeLessThan(repair); // önce kapalı dalı, sonra else-if zinciri
  });
});

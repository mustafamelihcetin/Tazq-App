import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useZen } from '@/features/dashboard/hooks/useZen';
import { useTaskStore, type Task } from '@/features/tasks/store/useTaskStore';
import { toDateKey } from '@/shared/utils/dateKey';

/**
 * ANA SAYFADAKİ ZEN — kartın GERÇEK veriyle ne zaman çıktığı.
 *
 * Motor (taskBalancer.test) ve kart (zenComponents.test) ayrı ayrı testliydi; ana
 * sayfanın ikisini bağlayan kanca hiç uçtan uca çalıştırılmamıştı. Bu test, gerçek
 * görev deposu ve gerçek mod/tercih mağazasıyla "kart çıkar mı?" sorusunu sorar.
 */

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${toDateKey(d)}T00:00:00Z`; };
let seq = 1000;
const task = (dueDate: string | null, extra: Partial<Task> = {}): Task => ({
  id: ++seq, title: `iş ${seq}`, description: '', isCompleted: false, priority: 'Medium', dueDate, tags: [], ...extra,
} as Task);

beforeEach(async () => {
  await AsyncStorage.clear();
  useTaskStore.setState({ tasks: [] });
});

const mount = async () => {
  const hook = renderHook(() => useZen('tr'));
  // "bugün sorma" kaydı diskten okunana kadar kart bilerek çizilmez
  await waitFor(() => expect(hook.result.current).toBeTruthy());
  await act(async () => { await Promise.resolve(); });
  return hook;
};

describe('birikim kartı', () => {
  it('3 gecikmiş iş → kart ÇIKAR', async () => {
    useTaskStore.setState({ tasks: [task(day(-1)), task(day(-2)), task(day(-3))] });
    const { result } = await mount();
    await waitFor(() => expect(result.current.cardVisible).toBe(true));
    expect(result.current.overduePlan.moves).toHaveLength(3);
  });

  it('2 gecikmiş iş → çıkmaz (tek-iki gecikme için ekranı kaplamaz)', async () => {
    useTaskStore.setState({ tasks: [task(day(-1)), task(day(-2))] });
    const { result } = await mount();
    expect(result.current.cardVisible).toBe(false);
  });

  it('gecikmiş ama SAATLİ/TEKRARLI işler kartı tetiklemez — Zen onlara dokunmaz', async () => {
    useTaskStore.setState({ tasks: [
      task(day(-1), { dueTime: new Date().toISOString() }),
      task(day(-2), { recurrence: 'Monthly' } as Partial<Task>),
      task(day(-3), { recurrence: 'Weekly' } as Partial<Task>),
    ] });
    const { result } = await mount();
    expect(result.current.cardVisible).toBe(false);
    // Ama gecikmiş sayısı dürüst: şeritte üçü de görünür
    expect(result.current.analysis.overdue).toHaveLength(3);
  });

  it('"Ben hallederim" → o gün bir daha çıkmaz, uygulama yeniden açılsa da', async () => {
    useTaskStore.setState({ tasks: [task(day(-1)), task(day(-2)), task(day(-3))] });
    const first = await mount();
    await waitFor(() => expect(first.result.current.cardVisible).toBe(true));
    act(() => first.result.current.dismissCard());
    expect(first.result.current.cardVisible).toBe(false);
    first.unmount();
    const again = await mount();
    await waitFor(() => expect(again.result.current.cardVisible).toBe(false));
  });
});

describe('taşan gün kartı', () => {
  it('bugün 6 iş → "Sadeleştir" kartı çıkar', async () => {
    useTaskStore.setState({ tasks: Array.from({ length: 6 }, () => task(day(0))) });
    const { result } = await mount();
    await waitFor(() => expect(result.current.overloadVisible).toBe(true));
    expect(result.current.analysis.todayLoad).toBe(6);
  });

  it('bugün 5 iş → çıkmaz (kapasitede, aşmıyor)', async () => {
    useTaskStore.setState({ tasks: Array.from({ length: 5 }, () => task(day(0))) });
    const { result } = await mount();
    expect(result.current.overloadVisible).toBe(false);
  });

  it('birikim varsa ÖNCE birikim kartı — iki Zen kartı aynı anda çıkmaz', async () => {
    useTaskStore.setState({ tasks: [
      ...Array.from({ length: 6 }, () => task(day(0))),
      task(day(-1)), task(day(-2)), task(day(-3)),
    ] });
    const { result } = await mount();
    await waitFor(() => expect(result.current.cardVisible).toBe(true));
    expect(result.current.overloadVisible).toBe(false);
  });
});

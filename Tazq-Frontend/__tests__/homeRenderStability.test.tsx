import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';

/**
 * ANA SAYFA — YENİDEN ÇİZİM KARARLILIĞI (2026-10-31).
 *
 * Halka paneli (Skia), alışkanlık şeridi ve görev satırları React.memo'lu; ama ana
 * sayfa onlara her render'da YENİ nesne/fonksiyon veriyordu, yani memo hiç tutmuyordu.
 * Bu test iki yönü birden çiviler:
 *  · İLGİSİZ state (komut paletini açmak) bu yüzeyleri yeniden çizdirmez.
 *  · VERİ değişince (yeni görev, tamamlanan alışkanlık, saat dilimi) yeniden çizilir ve
 *    yeni değeri gösterir — önbellek bayat veri SAKLAMAZ.
 */

// Ana sayfanın tamamı çiziliyor: tek başına ~4 sn; tam paketin yükünde 5 sn varsayılanı aşabiliyor.
jest.setTimeout(20_000);

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

// Sayaçlı yer tutucular: gerçek bileşenler gibi React.memo'lu (varsayılan sığ karşılaştırma).
const mockCount = { rings: 0, habits: 0, rows: 0 };
const mockLast: { rings: any; habits: any } = { rings: null, habits: null };
jest.mock('@/features/dashboard/components/TodayRings', () => {
  const R = jest.requireActual('react');
  return { TodayRings: R.memo((p: any) => { mockCount.rings++; mockLast.rings = p; return null; }) };
});
jest.mock('@/features/dashboard/components/MyDayHabits', () => {
  const R = jest.requireActual('react');
  return { MyDayHabits: R.memo((p: any) => { mockCount.habits++; mockLast.habits = p; return null; }) };
});
jest.mock('@/features/dashboard/components/MyDayTaskRow', () => {
  const R = jest.requireActual('react');
  return { MyDayTaskRow: R.memo(() => { mockCount.rows++; return null; }) };
});
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => [],
}));
// Gerçek router kararlı bir nesnedir; her çağrıda yeni nesne dönen bir sahte, memo'yu haksız yere bozardı.
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

const today = fmtDateKey();
const task = (id: number, title: string) => ({
  id, title, description: '', dueDate: `${today}T12:00:00`, isCompleted: false, priority: 'Medium' as const, tags: [],
});
const habit = (id: string, name: string, slot?: 'morning' | 'midday' | 'evening') => ({
  id, name, emoji: '📚', color: '#2563EB', completedDates: [] as string[], skippedDates: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z', ...(slot ? { slot } : {}),
});

async function mount() {
  const Home = require('../app/index').default;
  const r = render(<SafeAreaProvider initialMetrics={METRICS}><Home /></SafeAreaProvider>);
  await act(async () => {});
  return r;
}
const reset = () => { mockCount.rings = 0; mockCount.habits = 0; mockCount.rows = 0; };

beforeEach(() => {
  useTaskStore.setState({ tasks: [task(1, 'Rapor'), task(2, 'Fatura')] });
  useHabitStore.setState({ habits: [habit('h1', 'Kitap'), habit('h2', 'Su')] as any });
  reset();
});

describe('ana sayfa — ilgisiz state memo\'lu yüzeyleri yeniden çizdirmez', () => {
  it('komut paletini açmak halkaları, alışkanlıkları ve satırları çizdirmez', async () => {
    const r = await mount();
    expect(mockCount.rings).toBeGreaterThan(0);
    expect(mockCount.habits).toBeGreaterThan(0);
    expect(mockCount.rows).toBeGreaterThan(0);
    reset();

    await act(async () => { fireEvent.press(r.getByLabelText(/TAZQ Core/)); });

    expect(mockCount).toEqual({ rings: 0, habits: 0, rows: 0 });
    r.unmount();
  });
});

describe('ana sayfa — veri değişince yüzeyler GÜNCEL', () => {
  it('yeni görev halkanın hedefine ve satırlara yansır', async () => {
    const r = await mount();
    expect(mockLast.rings.metrics[0].total).toBe(2);
    reset();

    await act(async () => { useTaskStore.setState(s => ({ tasks: [...s.tasks, task(3, 'Spor')] })); });

    expect(mockCount.rings).toBeGreaterThan(0);
    expect(mockLast.rings.metrics[0].total).toBe(3);
    expect(mockLast.rings.detail.tasks.map((t: any) => t.title)).toContain('Spor');
    expect(mockCount.rows).toBeGreaterThan(0);
    r.unmount();
  });

  it('tamamlanan alışkanlık şeride ve halkaya yansır', async () => {
    const r = await mount();
    expect(mockLast.rings.metrics[2].done).toBe(0);

    await act(async () => {
      useHabitStore.setState(s => ({ habits: s.habits.map(h => (h.id === 'h1' ? { ...h, completedDates: [today] } : h)) }));
    });

    expect(mockLast.rings.metrics[2].done).toBe(1);
    expect(mockLast.habits.habits.find((h: any) => h.id === 'h1').isCompleted).toBe(true);
    r.unmount();
  });
});

describe('ana sayfa — kimliği sabit işleyiciler GÜNCEL veriyle çalışır', () => {
  it('sonradan eklenen alışkanlık, aynı onToggle ile işaretlenir', async () => {
    const r = await mount();
    const toggle = mockLast.habits.onToggle;

    await act(async () => { useHabitStore.setState(s => ({ habits: [...s.habits, habit('h3', 'Yürüyüş')] as any })); });
    // Kimlik aynı (memo tutuyor)…
    expect(mockLast.habits.onToggle).toBe(toggle);
    // …ama gövde güncel: yeni alışkanlığı tanıyor ve işaretliyor.
    const h3 = mockLast.habits.habits.find((h: any) => h.id === 'h3');
    await act(async () => { toggle(h3); });
    expect(useHabitStore.getState().habits.find(h => h.id === 'h3')!.completedDates).toContain(today);
    r.unmount();
  });
});

describe('ana sayfa — yenileme paneli uyandırır', () => {
  it('aşağı çekip yenileme bitince çiçek ve momentum uyanış sinyali alır', async () => {
    const { RefreshControl } = require('react-native');
    const r = await mount();
    expect(mockLast.rings.wake).toBe(0);
    await act(async () => { await r.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    expect(mockLast.rings.wake).toBe(1);
    // Momentum footer'da: aynı sinyal ona da gidiyor.
    expect(mockLast.rings.footer.props.children.props.wake).toBe(1);
    r.unmount();
  });
});

describe('ana sayfa — saat dilimi değişince alışkanlık sırası yenilenir', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('11:59 → 12:00: öğle alışkanlığı sabahınkinin önüne geçer', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 31, 11, 59, 30) });
    useHabitStore.setState({ habits: [habit('m', 'Sabah', 'morning'), habit('n', 'Öğle', 'midday')] as any });

    const r = await mount();
    expect(mockLast.habits.habits.map((h: any) => h.id)).toEqual(['m', 'n']);

    // Ana sayfanın saat zamanlayıcısı bir sonraki saat başında tetiklenir.
    await act(async () => { jest.advanceTimersByTime(60_000); });

    expect(mockLast.habits.habits.map((h: any) => h.id)).toEqual(['n', 'm']);
    r.unmount();
  });
});

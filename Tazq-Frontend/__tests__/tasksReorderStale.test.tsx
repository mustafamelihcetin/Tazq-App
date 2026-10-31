import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { fmtDateKey } from '@/features/habits';

/**
 * GÖREVLER — BAYAT KAPANIŞLA YANLIŞ SIRALAMA (2026-10-31 denetimi).
 *
 * Satır elle yazılmış bir karşılaştırıcıyla memo'lanıyordu ve fonksiyon prop'larını hiç
 * karşılaştırmıyordu. Görevi ve konumu (ilk/orta/son) değişmeyen satır, ESKİ çizimdeki
 * `handleMoveTask(i)` kapanışını tutuyordu: eski sıra numarası + eski görev sırası.
 * Ekran okuyucunun "yukarı taşı" eylemi satırı açmadan çalıştığı için hata orada çıkıyordu:
 * C'yi yukarı taşı → A C B D; sonra B'yi yukarı taşı → B A C D (C'nin taşınması geri alındı).
 */
jest.setTimeout(30_000);

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/tasks',
  useSegments: () => [],
}));

const today = fmtDateKey();
const task = (id: number, title: string) => ({
  id, title, description: '', dueDate: `${today}T12:00:00`, isCompleted: false, priority: 'Medium' as const, tags: [], sortOrder: id,
});
const visibleOrder = () => useTaskStore.getState().tasks.map(t => t.title).join(' ');

async function mount() {
  const Tasks = require('../app/tasks').default;
  const r = render(<SafeAreaProvider initialMetrics={METRICS}><Tasks /></SafeAreaProvider>);
  await act(async () => {});
  return r;
}
const moveUp = (r: ReturnType<typeof render>, title: string) =>
  fireEvent(r.getByLabelText(new RegExp(`^${title},`)), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });

describe('Görevler — ekran okuyucuyla art arda taşıma', () => {
  beforeEach(() => {
    usePrefsStore.setState({ taskSortBy: 'creation', taskFilter: 'all', taskHideCompleted: false } as never);
    useTaskStore.setState({ tasks: [task(1, 'A'), task(2, 'B'), task(3, 'C'), task(4, 'D')] });
  });

  it('C yukarı, sonra B yukarı → A B C D (önceki taşıma geri alınmaz)', async () => {
    const r = await mount();
    await act(async () => { moveUp(r, 'C'); });
    expect(visibleOrder()).toBe('A C B D');
    await act(async () => { moveUp(r, 'B'); });
    expect(visibleOrder()).toBe('A B C D');
    r.unmount();
  });
});

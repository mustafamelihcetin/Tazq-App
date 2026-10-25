/**
 * ALIŞKANLIK EŞİTLEMESİ — kapılar. En pahalı hata: yeni cihazdaki BOŞ yerel liste buluttaki
 * yılların geçmişini ezmesi. Gönderim yalnız birleştirme bittikten sonra açılır.
 */
const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock('@/shared/services/api', () => ({ HabitSyncService: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) } }));

import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { hydrateHabits, pushHabits, resetHabitsSync, isHabitsSyncReady } from '@/features/habits/sync/habitsSync';

const habit = (id: string, dates: string[] = []) => ({ id, name: id, emoji: 'x', color: '#000', completedDates: dates, skippedDates: [], createdAt: '2026-10-01T00:00:00.000Z' });

beforeEach(() => {
  mockGet.mockReset(); mockPut.mockReset();
  mockPut.mockResolvedValue(undefined);
  resetHabitsSync();
  useHabitStore.setState({ habits: [] });
});

describe('habitsSync', () => {
  it('birleştirme olmadan gönderim YOK (boş liste bulutu ezemez)', async () => {
    expect(await pushHabits(1)).toBe(false);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('yeni cihaz: bulut yerel boş listeye gelir, geri yazma gerekmez', async () => {
    mockGet.mockResolvedValue({ data: JSON.stringify([habit('a', ['2026-10-20'])]) });
    expect(await hydrateHabits(1)).toBe(true);
    expect(useHabitStore.getState().habits.map((h) => h.id)).toEqual(['a']);
    expect(mockPut).not.toHaveBeenCalled();
    expect(isHabitsSyncReady(1)).toBe(true);
  });

  it('iki taraf da doluysa birleşir ve birleşmiş hâl buluta yazılır', async () => {
    useHabitStore.setState({ habits: [habit('a', ['2026-10-21'])] });
    mockGet.mockResolvedValue({ data: JSON.stringify([habit('a', ['2026-10-20'])]) });
    await hydrateHabits(1);
    expect(useHabitStore.getState().habits[0].completedDates).toEqual(['2026-10-20', '2026-10-21']);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('çevrimdışı/eski sunucu: yerel korunur, gönderim kapalı kalır', async () => {
    useHabitStore.setState({ habits: [habit('a')] });
    mockGet.mockRejectedValue(new Error('offline'));
    expect(await hydrateHabits(1)).toBe(false);
    expect(useHabitStore.getState().habits.map((h) => h.id)).toEqual(['a']);
    expect(await pushHabits(1)).toBe(false);
  });

  it('çıkış kapıyı kapatır: silinen liste gönderilemez', async () => {
    mockGet.mockResolvedValue({ data: null });
    await hydrateHabits(1);
    resetHabitsSync();
    useHabitStore.setState({ habits: [] });
    expect(await pushHabits(1)).toBe(false);
  });

  it('başka kullanıcı için açılmış kapı bu kullanıcıya gönderim yaptırmaz', async () => {
    mockGet.mockResolvedValue({ data: null });
    await hydrateHabits(1);
    expect(await pushHabits(2)).toBe(false);
  });
});

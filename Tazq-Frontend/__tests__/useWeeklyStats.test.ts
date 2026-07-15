import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWeeklyStats } from '@/features/user/hooks/useWeeklyStats';
import { useFocusStore } from '@/features/focus/store/useFocusStore';

const mockGetStats = jest.fn();
jest.mock('@/shared/services/api', () => ({
  FocusService: { getStats: () => mockGetStats() },
}));

const mockSwallow = jest.fn();
jest.mock('@/shared/utils/swallow', () => ({ swallow: (...a: unknown[]) => mockSwallow(...a) }));

describe('useWeeklyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFocusStore.setState({ localStreak: 0, bestStreak: 0 });
    mockGetStats.mockResolvedValue({ weeklyFocus: [], lastWeekFocusMinutes: 0, activeStreak: 0 });
  });

  it('starts in the loading state', () => {
    const { result } = renderHook(() => useWeeklyStats());
    expect(result.current.loading).toBe(true);
  });

  it('loads weekly focus and last week minutes', async () => {
    const weekly = [{ day: 'Mon', minutes: 30 }];
    mockGetStats.mockResolvedValue({ weeklyFocus: weekly, lastWeekFocusMinutes: 120, activeStreak: 0 });
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    expect(result.current.weeklyFocus).toEqual(weekly);
    expect(result.current.lastWeekMinutes).toBe(120);
    expect(result.current.loading).toBe(false);
  });

  it('defaults missing fields instead of crashing', async () => {
    // Sunucu alanları eksik gönderirse ekran boş veriyle çalışmalı, patlamamalı.
    mockGetStats.mockResolvedValue({});
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    expect(result.current.weeklyFocus).toEqual([]);
    expect(result.current.lastWeekMinutes).toBe(0);
  });

  it('seeds the local streak from the server when local is empty', async () => {
    mockGetStats.mockResolvedValue({ weeklyFocus: [], lastWeekFocusMinutes: 0, activeStreak: 7 });
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    // Yeni cihaz/kurulumda yerel seri 0'dır; sunucudaki gerçek seri kaybolmamalı.
    expect(useFocusStore.getState().localStreak).toBe(7);
  });

  it('does not overwrite a local streak that is already set', async () => {
    useFocusStore.setState({ localStreak: 12 });
    mockGetStats.mockResolvedValue({ weeklyFocus: [], lastWeekFocusMinutes: 0, activeStreak: 3 });
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    expect(useFocusStore.getState().localStreak).toBe(12);
  });

  it('reports failures but still clears loading', async () => {
    mockGetStats.mockRejectedValue({ response: { status: 500 } });
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    expect(mockSwallow).toHaveBeenCalledWith('weeklyStats.refresh', expect.anything());
    // Hata olsa da yükleme kapısı açılmalı; yoksa ekran sonsuza dek "yükleniyor" kalır.
    expect(result.current.loading).toBe(false);
  });

  it('stays quiet on 401 (session refresh handles it)', async () => {
    mockGetStats.mockRejectedValue({ response: { status: 401 } });
    const { result } = renderHook(() => useWeeklyStats());

    await act(async () => { await result.current.refresh(); });

    // 401 beklenen bir durum — alarm gürültüsü üretmemeli.
    expect(mockSwallow).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

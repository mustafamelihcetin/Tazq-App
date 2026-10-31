import { renderHook, act } from '@testing-library/react-native';

/**
 * ANA SAYFA SEKME GEÇİŞİNDE YENİDEN KURULUYOR (alt menü `router.replace`) — 2026-10-31, cihazda.
 *
 * Her dönüşte: açılış animasyonları baştan (çiçek açılışı, 0'dan sayım, üç nefes), haftalık
 * istatistik boş başlıyor, momentum iskelete dönüyordu. Kural: oturumdaki İLK gösterim giriştir;
 * sonraki dönüşler veriyi ANINDA gösterir, yalnız hafif uyanış işareti oynar.
 */

describe('useFirstInSession', () => {
  it('aynı anahtar oturumda yalnız ilk mount\'ta true', () => {
    const { useFirstInSession } = require('@/shared/components/EntranceStage');
    const a = renderHook(() => useFirstInSession('test.key'));
    expect(a.result.current).toBe(true);
    a.unmount();
    const b = renderHook(() => useFirstInSession('test.key'));
    expect(b.result.current).toBe(false);
  });
});

jest.mock('@/shared/services/api', () => ({
  FocusService: { getStats: jest.fn(async () => ({ weeklyFocus: [{ day: 'Mon', minutes: 30 }], lastWeekFocusMinutes: 60, activeStreak: 0 })) },
}));

describe('useWeeklyStats — oturum önbelleği', () => {
  it('yeniden kurulumda son bilinen veriyle ve loading=false başlar; yenileme arka planda', async () => {
    const { useWeeklyStats } = require('@/features/user/hooks/useWeeklyStats');
    const first = renderHook(() => useWeeklyStats());
    expect(first.result.current.loading).toBe(true);
    await act(async () => { await first.result.current.refresh(); });
    expect(first.result.current.weeklyFocus).toHaveLength(1);
    first.unmount();

    const again = renderHook(() => useWeeklyStats());
    expect(again.result.current.loading).toBe(false);
    expect(again.result.current.weeklyFocus).toHaveLength(1);
    expect(again.result.current.lastWeekMinutes).toBe(60);
    // Arka plan yenilemesi ekranı iskelete DÖNDÜRMEZ.
    let p: Promise<void>;
    act(() => { p = again.result.current.refresh(); });
    expect(again.result.current.loading).toBe(false);
    await act(async () => { await p; });
  });
});

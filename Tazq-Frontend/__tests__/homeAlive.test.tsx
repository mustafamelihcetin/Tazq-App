import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { sweepLift, petalAngle, petalRadius } from '@/features/dashboard/components/DayOrb';

/**
 * ANA SAYFA "CANLIYIM" DİYOR (2026-10-31).
 *
 * Kullanıcı: halkalar ve momentum sayfa güncellenince ya da yeni veri gelince sabit
 * kalmasın. Kural (bkz. memory/animasyon dili): her hareket bir şey söyler ve DURUR.
 */

describe('uyanış dalgası (sweepLift)', () => {
  it('dinlenirken hiçbir yaprak parlamaz', () => {
    for (const i of [0, 3, 7]) {
      expect(sweepLift(0, i, 8)).toBe(0);
      expect(sweepLift(1, i, 8)).toBe(0);
    }
  });

  it('tepe saat yönünde yaprak yaprak ilerler', () => {
    const peakAt = (t: number) => {
      const v = Array.from({ length: 8 }, (_, i) => sweepLift(t, i, 8));
      return v.indexOf(Math.max(...v));
    };
    const peaks = [0.15, 0.35, 0.55, 0.75].map(peakAt);
    expect(peaks).toEqual([...peaks].sort((a, b) => a - b));
    expect(peaks[0]).toBeLessThan(peaks[3]);
  });

  it('parlama 0…1 aralığında', () => {
    for (let t = 0.05; t < 1; t += 0.1) for (let i = 0; i < 6; i++) {
      const v = sweepLift(t, i, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('yaprak yerleşimi — sayı değişince kayacağı hedef', () => {
  it('ilk yaprak tepede, sıra saat yönünde', () => {
    expect(petalAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
    expect(petalAngle(1, 4)).toBeCloseTo(0);
  });
  it('yaprak arttıkça yarıçap küçülür, en büyük değer sınırlı', () => {
    expect(petalRadius(12, 72)).toBeLessThan(petalRadius(4, 72));
    expect(petalRadius(1, 72)).toBeLessThanOrEqual(72 * 0.15);
  });
});

// ── Uyanış sinyali ─────────────────────────────────────────────────────────────
let mockFocusCb: (() => void | (() => void)) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => { mockFocusCb = cb; },
}));

describe('useWakeSignal', () => {
  // Her test yeni bir OTURUM: "oturumdaki ilk gösterim" kaydı (useFirstInSession) modül düzeyinde.
  const { useWakeSignal } = require('@/features/dashboard/hooks/useWakeSignal');
  const { resetSessionForTests } = require('@/shared/components/EntranceStage');
  let appStateCb: ((s: string) => void) | null = null;
  beforeEach(() => {
    resetSessionForTests();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      appStateCb = cb; return { remove: jest.fn() };
    }) as any);
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
  });
  afterEach(() => jest.restoreAllMocks());
  const advance = (ms: number) => (Date.now as jest.Mock).mockReturnValue((Date.now as jest.Mock)() + ms);

  it('ilk odak uyandırmaz (açılışın kendi animasyonu var), geri dönüş uyandırır', () => {
    const { result } = renderHook(() => useWakeSignal());
    let leave: void | (() => void);
    act(() => { leave = mockFocusCb!(); });
    expect(result.current[0]).toBe(0);
    act(() => { (leave as () => void)(); advance(5000); mockFocusCb!(); });
    expect(result.current[0]).toBe(1);
  });

  it('öne gelme yalnız ana sayfa odaktayken uyandırır', () => {
    const { result } = renderHook(() => useWakeSignal());
    let leave: void | (() => void);
    act(() => { leave = mockFocusCb!(); });
    act(() => { advance(5000); appStateCb!('active'); });
    expect(result.current[0]).toBe(1);
    act(() => { (leave as () => void)(); advance(5000); appStateCb!('active'); });
    expect(result.current[0]).toBe(1);
  });

  it('aynı oturumda sayfa yeniden kurulunca (sekme dönüşü) ilk odak da uyandırır', () => {
    const a = renderHook(() => useWakeSignal());
    act(() => { mockFocusCb!(); });
    a.unmount();
    const b = renderHook(() => useWakeSignal());
    act(() => { advance(5000); mockFocusCb!(); });
    expect(b.result.current[0]).toBe(1);
  });

  it('aynı ana düşen iki sinyal tek uyanış', () => {
    const { result } = renderHook(() => useWakeSignal());
    act(() => { mockFocusCb!(); });
    act(() => { advance(5000); result.current[1](); appStateCb!('active'); });
    expect(result.current[0]).toBe(1);
  });
});

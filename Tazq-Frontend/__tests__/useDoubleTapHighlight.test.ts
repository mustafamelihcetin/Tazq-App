import { renderHook, act } from '@testing-library/react-native';
import { useDoubleTapHighlight, DOUBLE_TAP_WINDOW_MS } from '@/features/user/hooks/useDoubleTapHighlight';

describe('useDoubleTapHighlight', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('stays idle after a single tap', () => {
    const { result } = renderHook(() => useDoubleTapHighlight(1600));

    act(() => result.current.onTap());

    expect(result.current.active).toBe(false);
    expect(result.current.burstKey).toBe(0);
  });

  it('activates on a double tap', () => {
    const onTrigger = jest.fn();
    const { result } = renderHook(() => useDoubleTapHighlight(1600, onTrigger));

    act(() => { result.current.onTap(); result.current.onTap(); });

    expect(result.current.active).toBe(true);
    expect(result.current.burstKey).toBe(1);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores taps that are too far apart', () => {
    const { result } = renderHook(() => useDoubleTapHighlight(1600));

    act(() => result.current.onTap());
    act(() => { jest.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS + 50); });
    act(() => result.current.onTap());

    // İki ayrı tek dokunma çift sayılmamalı.
    expect(result.current.active).toBe(false);
  });

  it('fades out after the given duration', () => {
    const { result } = renderHook(() => useDoubleTapHighlight(1600));

    act(() => { result.current.onTap(); result.current.onTap(); });
    expect(result.current.active).toBe(true);

    act(() => { jest.advanceTimersByTime(1600); });
    expect(result.current.active).toBe(false);
  });

  it('does not fade early when double-tapped again', () => {
    const { result } = renderHook(() => useDoubleTapHighlight(1600));

    act(() => { result.current.onTap(); result.current.onTap(); });
    act(() => { jest.advanceTimersByTime(1000); });

    // İkinci çift dokunma: vurgu yenilenmeli, eski zamanlayıcı erken söndürmemeli.
    act(() => { result.current.onTap(); result.current.onTap(); });
    expect(result.current.burstKey).toBe(2);

    act(() => { jest.advanceTimersByTime(1000); }); // ilk zamanlayıcı bu noktada dolardı
    expect(result.current.active).toBe(true);

    act(() => { jest.advanceTimersByTime(600); });
    expect(result.current.active).toBe(false);
  });

  it('keeps firing while taps stay inside the window', () => {
    const onTrigger = jest.fn();
    const { result } = renderHook(() => useDoubleTapHighlight(1600, onTrigger));

    // Hook'a çıkarılmadan önceki davranış: sayaç her dokunuşta güncellenir, yani
    // pencere içinde kalan her ard arda dokunuş tetikler (3 dokunma → 2 tetikleme).
    // Refactor bunu değiştirmemeli.
    act(() => { result.current.onTap(); result.current.onTap(); result.current.onTap(); });

    expect(onTrigger).toHaveBeenCalledTimes(2);
    expect(result.current.burstKey).toBe(2);
  });

  it('cancels the fade timer on unmount', () => {
    const { result, unmount } = renderHook(() => useDoubleTapHighlight(1600));

    act(() => { result.current.onTap(); result.current.onTap(); });

    // Zamanlayıcı iptal edilmezse unmount sonrası setState çağrılır.
    expect(() => { unmount(); jest.advanceTimersByTime(2000); }).not.toThrow();
  });
});

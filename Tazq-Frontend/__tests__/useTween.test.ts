import { renderHook, act } from '@testing-library/react-native';
import { useTween } from '@/shared/hooks/useTween';

/**
 * Halka dolumları için JS ara-değer (tween) — `animatedProps` yerine.
 *
 * Cihazda görüldü (2026-10-25): Bugün halkalarının yayları Reanimated `animatedProps` ile
 * çiziliyordu; tur sırasında ana sayfa yeniden çizildikçe yaylar BOŞ kalıyordu (statik
 * son değer vermek de çözmedi). React'in çizdiği değer ekranda olan değer olsun diye
 * halka değeri JS'te ilerletilip düz prop olarak veriliyor.
 */
describe('useTween', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hedefe ulaşır ve orada kalır', () => {
    const { result, rerender } = renderHook(({ t }) => useTween(t, { duration: 300 }), { initialProps: { t: 0 } });
    expect(result.current).toBe(0);
    rerender({ t: 0.6 });
    act(() => { jest.advanceTimersByTime(400); });
    expect(result.current).toBeCloseTo(0.6, 5);
  });

  it('ara karede başlangıç ile hedef arasında', () => {
    const { result, rerender } = renderHook(({ t }) => useTween(t, { duration: 300 }), { initialProps: { t: 0 } });
    rerender({ t: 1 });
    act(() => { jest.advanceTimersByTime(120); });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1);
  });

  it('hareketi azalt → anında hedef', () => {
    const { result, rerender } = renderHook(({ t }) => useTween(t, { duration: 300, reduceMotion: true }), { initialProps: { t: 0 } });
    rerender({ t: 0.4 });
    expect(result.current).toBe(0.4);
  });

  it('gecikme süresince başlangıçta bekler', () => {
    const { result, rerender } = renderHook(({ t }) => useTween(t, { duration: 300, delay: 200 }), { initialProps: { t: 0 } });
    rerender({ t: 1 });
    act(() => { jest.advanceTimersByTime(150); });
    expect(result.current).toBe(0);
    act(() => { jest.advanceTimersByTime(600); });
    expect(result.current).toBeCloseTo(1, 5);
  });
});

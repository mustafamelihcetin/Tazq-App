import { renderHook, act } from '@testing-library/react-native';
import { useHasSettled } from '@/shared/hooks/useSettledValue';

describe('useHasSettled', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('değer değişmeye devam ettikçe false; durulunca true', () => {
    const { result, rerender } = renderHook(({ v }) => useHasSettled(v, 400), { initialProps: { v: 0 } });
    expect(result.current).toBe(false);
    act(() => { jest.advanceTimersByTime(300); });
    rerender({ v: 5 }); // hidrasyon: değer değişti → sayaç baştan
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current).toBe(false);
    act(() => { jest.advanceTimersByTime(150); });
    expect(result.current).toBe(true);
  });

  it('bir kez durulduktan sonra sonraki değişimler geri almaz', () => {
    const { result, rerender } = renderHook(({ v }) => useHasSettled(v, 400), { initialProps: { v: 8 } });
    act(() => { jest.advanceTimersByTime(400); });
    rerender({ v: 9 });
    expect(result.current).toBe(true);
  });
});

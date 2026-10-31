import { renderHook } from '@testing-library/react-native';
import { useLatestCallback } from '@/shared/hooks/useLatestCallback';

describe('useLatestCallback', () => {
  it('kimlik render\'lar boyunca aynı kalır', () => {
    const { result, rerender } = renderHook(({ n }) => useLatestCallback(() => n), { initialProps: { n: 1 } });
    const first = result.current;
    rerender({ n: 2 });
    expect(result.current).toBe(first);
  });

  it('çağrıldığında EN SON gövdeyi çalıştırır (bayat kapanış yok)', () => {
    const { result, rerender } = renderHook(({ n }) => useLatestCallback((x: number) => x + n), { initialProps: { n: 1 } });
    const fn = result.current;
    expect(fn(10)).toBe(11);
    rerender({ n: 5 });
    expect(fn(10)).toBe(15);
  });
});

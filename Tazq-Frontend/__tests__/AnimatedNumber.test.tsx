import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';
import { useSettledValue } from '@/shared/hooks/useSettledValue';
import { renderHook } from '@testing-library/react-native';

/**
 * Momentum sayacı — "git gel" eden skor.
 *
 * İlk açılışta kullanıcı 14 → 15 → 17 → 18 → 17 gibi bir zıplama görüyordu. Sebep
 * animasyon değil, VERİYDİ: skor görev/odak/seri/alışkanlık store'larından besleniyor ve
 * her biri ayrı ayrı hidrate oldukça yeniden hesaplanıyor. İki katman birlikte çözüyor:
 * durulma kapısı ara değerleri yutuyor, sayaç kalanı yumuşakça çıkıyor.
 */

// rAF'i kontrol edilebilir kılar: gerçek kare beklemeden animasyonu ilerletiriz.
function withFakeRaf() {
  let now = 0;
  const callbacks: Array<() => void> = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(((cb: any) => {
    callbacks.push(cb);
    return callbacks.length as any;
  }) as any);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((() => {}) as any);
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  return {
    advance(ms: number) {
      now += ms;
      const pending = callbacks.splice(0, callbacks.length);
      act(() => { pending.forEach((cb) => cb()); });
    },
  };
}

const textOf = (r: { toJSON: () => any }) => {
  const json: any = r.toJSON();
  return Array.isArray(json.children) ? String(json.children[0]) : '';
};

describe('AnimatedNumber', () => {
  afterEach(() => jest.restoreAllMocks());

  it('from verilince sıfırdan hedefe sayar, ara değerde takılmaz', () => {
    const raf = withFakeRaf();
    const r = render(<AnimatedNumber value={40} from={0} duration={1000} />);

    expect(textOf(r)).toBe('0');

    raf.advance(300);
    const mid = Number(textOf(r));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(40);

    raf.advance(1000);
    expect(textOf(r)).toBe('40');
  });

  it('süre bitiminde hedefin TAM üstünde durur — yuvarlama artığı bırakmaz', () => {
    const raf = withFakeRaf();
    const r = render(<AnimatedNumber value={17} from={0} duration={800} />);
    raf.advance(800);
    expect(textOf(r)).toBe('17');
  });

  it('yeni hedef gelince sıfırdan değil, mevcut değerden devam eder', () => {
    // Aksi halde her güncellemede sayı 0'a düşüp yeniden tırmanır — ekranda
    // "git gel" hissinin ta kendisi.
    const raf = withFakeRaf();
    const r = render(<AnimatedNumber value={40} from={0} duration={1000} />);
    raf.advance(1000);
    expect(textOf(r)).toBe('40');

    r.update(<AnimatedNumber value={45} from={0} duration={1000} />);
    raf.advance(1);
    expect(Number(textOf(r))).toBeGreaterThanOrEqual(40);
  });

  it('duration 0 ise animasyon yok — lite mod', () => {
    const r = render(<AnimatedNumber value={62} from={0} duration={0} />);
    expect(textOf(r)).toBe('62');
  });
});

describe('useSettledValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('durulmayan ara değerleri yayınlamaz — yalnızca sonuncusu geçer', () => {
    const { result, rerender } = renderHook(({ v }) => useSettledValue(v, 400), {
      initialProps: { v: 14 },
    });

    // Hidrasyon dalgası: değerler hızlı hızlı değişiyor.
    rerender({ v: 15 });
    act(() => { jest.advanceTimersByTime(100); });
    rerender({ v: 18 });
    act(() => { jest.advanceTimersByTime(100); });
    rerender({ v: 17 });

    // Hiçbiri henüz durulmadı → ilk değer korunuyor.
    expect(result.current).toBe(14);

    act(() => { jest.advanceTimersByTime(400); });
    expect(result.current).toBe(17);
  });

  it('değer sabitse gecikme uygulanmaz', () => {
    const { result } = renderHook(() => useSettledValue(30, 400));
    expect(result.current).toBe(30);
  });
});

/**
 * Panel saati geri kalmamalı ("1-2 dakika geriye düşebiliyor", 2026-10-30).
 */
import React from 'react';
import { Text, AppState } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useMinuteClock, msToNextMinute } from '@/shared/hooks/useMinuteClock';

const Clock = () => {
  const d = useMinuteClock();
  return <Text>{`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`}</Text>;
};

describe('dakika saati', () => {
  afterEach(() => jest.useRealTimers());

  it('sınır hesabı milisaniyeyi de sayar', () => {
    expect(msToNextMinute(Date.UTC(2026, 9, 30, 12, 30, 59, 900))).toBe(150);
    expect(msToNextMinute(Date.UTC(2026, 9, 30, 12, 30, 0, 0))).toBe(60_050);
  });

  it('kaymaya rağmen dakika sınırında güncellenir (setInterval gibi birikmez)', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12, 30, 10, 700) });
    const { getByText } = render(<Clock />);
    expect(getByText('12:30')).toBeTruthy();
    // 50 dakika ilerle: her tur bir sonraki sınıra yeniden hizalanır.
    act(() => { jest.advanceTimersByTime(50 * 60_000); });
    expect(getByText('13:20')).toBeTruthy();
  });

  it('arka plandan dönünce zamanlayıcıyı beklemeden hemen yenilenir', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12, 30, 5) });
    const listeners: Array<(s: string) => void> = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
      listeners.push(fn);
      return { remove: () => {} };
    }) as never);
    const { getByText } = render(<Clock />);
    // Arka planda zamanlayıcı ÇALIŞMADI ama duvar saati 12 dakika ilerledi.
    jest.setSystemTime(new Date(2026, 9, 30, 12, 42, 20));
    act(() => { listeners.forEach(fn => fn('active')); });
    expect(getByText('12:42')).toBeTruthy();
    spy.mockRestore();
  });
});

import React from 'react';
import { Animated, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Touchable } from '@/shared/components/Touchable';

/**
 * BASIŞ ÖLÇEĞİ (2026-10-31, better-ui): düğme/hap 0.96, geniş yüzey 0.98, devre dışı hiç.
 * Yay değil 150 ms ease-out — hedefi aşıp geri dönmez.
 */
describe('Touchable — boyuta göre basış ölçeği', () => {
  let timing: jest.SpyInstance;
  beforeEach(() => { timing = jest.spyOn(Animated, 'timing'); });
  afterEach(() => timing.mockRestore());

  const pressAt = (width: number, disabled = false) => {
    const r = render(<Touchable disabled={disabled} accessibilityRole="button"><Text>x</Text></Touchable>);
    const el = r.getByRole('button');
    fireEvent(el, 'layout', { nativeEvent: { layout: { width, height: 44, x: 0, y: 0 } } });
    fireEvent(el, 'pressIn', {});
    return timing.mock.calls.map(c => c[1]);
  };

  it('küçük öğe 0.96, 150 ms', () => {
    const [cfg] = pressAt(120);
    expect(cfg.toValue).toBe(0.96);
    expect(cfg.duration).toBe(150);
  });

  it('geniş yüzey 0.98 (kart kenarı kaymasın)', () => {
    expect(pressAt(360)[0].toValue).toBe(0.98);
  });

  it('devre dışı öğe küçülmez', () => {
    expect(pressAt(120, true)).toHaveLength(0);
  });
});

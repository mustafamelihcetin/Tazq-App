import React from 'react';
import { Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { render, act } from '@testing-library/react-native';
import { EntranceStage } from '@/shared/components/EntranceStage';
import { useBootStore } from '@/shared/store/useBootStore';

/**
 * AÇILIŞ SAHNESİ (2026-10-31): sayfa açılış katmanı kalkınca sırayla gelir; yalnız açılışta,
 * tur açıkken hiç beklemeden. Ağaç üretimde olduğu gibi katmanın ALTINDA mount ediliyor.
 */
// Kök = sahnenin Animated.View'u.
const opacityOf = (r: ReturnType<typeof render>) => {
  const root = r.toJSON() as ReactTestRendererJSON;
  return StyleSheet.flatten(root.props.style as StyleProp<ViewStyle>)?.opacity;
};

const ui = (enabled = true) => (
  <EntranceStage order={1} enabled={enabled}><Text testID="stage">x</Text></EntranceStage>
);

describe('EntranceStage', () => {
  beforeEach(() => useBootStore.setState({ splashDone: false }));

  it('açılış sürerken gizli, açılış bitince görünür', () => {
    const r = render(ui());
    expect(opacityOf(r)).toBe(0);
    act(() => { useBootStore.getState().setSplashDone(); });
    r.rerender(ui());
    expect(opacityOf(r)).toBe(1);
  });

  it('tur açıksa (enabled=false) beklemeden görünür', () => {
    const r = render(ui(false));
    r.rerender(ui(false));
    expect(opacityOf(r)).toBe(1);
  });

  it('açılış sinyali HİÇ gelmezse (kesilen animasyon, hata) içerik emniyet süresinde görünür', () => {
    jest.useFakeTimers();
    try {
      const r = render(ui());
      expect(opacityOf(r)).toBe(0);
      act(() => { jest.advanceTimersByTime(5000); });
      r.rerender(ui());
      expect(opacityOf(r)).toBe(1);
    } finally { jest.useRealTimers(); }
  });

  it('uygulama arka plandayken (kare çizilmiyor) giriş beklenmez, içerik görünür', () => {
    const { AppState } = require('react-native');
    const prev = AppState.currentState;
    AppState.currentState = 'background';
    try {
      const r = render(ui());
      act(() => { useBootStore.getState().setSplashDone(); });
      r.rerender(ui());
      expect(opacityOf(r)).toBe(1);
    } finally { AppState.currentState = prev; }
  });

  it('açılıştan SONRA mount edilen sayfa hiç gecikmez (sık etkileşim anında yanıt verir)', () => {
    useBootStore.setState({ splashDone: true });
    const r = render(ui());
    expect(opacityOf(r)).toBe(1);
  });
});

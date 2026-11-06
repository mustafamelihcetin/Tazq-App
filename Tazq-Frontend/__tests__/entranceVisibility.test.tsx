import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { EntranceStage } from '@/shared/components/EntranceStage';
import { useBootStore } from '@/shared/store/useBootStore';

/** Android 9'da cihazda: panelin altı boş kaldı. İçerik görünürlüğü animasyonun bitmesine bağlı olamaz. */
describe('giriş animasyonu içeriği gizli bırakamaz', () => {
  const opacity = (ui: ReturnType<typeof render>) => {
    const host = ui.getByText('içerik', { includeHiddenElements: true }).parent?.parent;
    return StyleSheet.flatten(host?.props.style)?.opacity;
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('animasyon hiç ilerlemese de süre dolunca React opak yazar', () => {
    useBootStore.setState({ splashDone: false } as never);
    const ui = render(<EntranceStage order={1}><Text>içerik</Text></EntranceStage>);
    act(() => { useBootStore.setState({ splashDone: true } as never); });
    act(() => { jest.advanceTimersByTime(100 + 300 + 400); });
    expect(opacity(ui)).toBe(1);
  });

  it('açılış zaten bittiyse baştan görünür', () => {
    useBootStore.setState({ splashDone: true } as never);
    expect(opacity(render(<EntranceStage><Text>içerik</Text></EntranceStage>))).toBe(1);
  });

  it('kartlar opaklıkla girmez', () => {
    const src = fs.readFileSync(path.join(__dirname, '../shared/components/BentoCard.tsx'), 'utf8');
    expect(src).not.toMatch(/from=\{\{[^}]*opacity:\s*0/);
  });
});

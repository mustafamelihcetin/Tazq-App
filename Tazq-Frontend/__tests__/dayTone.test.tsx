import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { partOf } from '@/shared/utils/dayPart';
import { DisplayStatus } from '@/shared/components/DisplayPanel';

/**
 * GÜNÜN SAATİ (B4, 2026-11-01) — panel "şimdi"yi bilir: durum şeridinde tarihin altında kısa, ince
 * bir çizgi vaktin tonunu taşır (sabah · öğle · akşam · gece). ZEMİN DEĞİŞMEZ (kullanıcı: panel
 * kartlarla aynı kalmalı). Renkler temadan; vakit tanımı tek yerde (gökyüzü de aynı tanımı kullanır).
 */
describe('vakit tanımı tek yerde', () => {
  it('saat → vakit', () => {
    expect([5, 11, 12, 16, 17, 21, 22, 4].map(partOf)).toEqual(['morning', 'morning', 'noon', 'noon', 'evening', 'evening', 'night', 'night']);
  });

  it('gökyüzü modeli kendi kopyasını tutmaz', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/report/weekSky.ts'), 'utf8');
    expect(src).toContain("from '@/shared/utils/dayPart'");
    expect(src).not.toContain('export function partOf');
  });
});

describe('DisplayStatus tonu', () => {
  afterEach(() => jest.useRealTimers());

  const toneAt = (hour: number) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 1, hour, 30));
    const ui = render(<DisplayStatus tonal />);
    return ui.queryByTestId('day-tone');
  };

  it('tonal şeritte vakit çizgisi var ve vakte göre renk değişir', () => {
    const morning = toneAt(9);
    const night = toneAt(23);
    expect(morning).toBeTruthy();
    expect(night).toBeTruthy();
    const color = (n: ReturnType<typeof toneAt>) => JSON.stringify(n?.props.style);
    expect(color(morning)).not.toBe(color(night));
  });

  it('tonal değilse (ör. yönetim paneli) çizgi yok', () => {
    expect(render(<DisplayStatus label="x" />).queryByTestId('day-tone')).toBeNull();
  });

  it('ana sayfa paneli bugünde tonlu, geçmiş günde değil', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/dashboard/components/TodayRings.tsx'), 'utf8');
    expect(src).toContain('tonal={back === 0}');
  });
});

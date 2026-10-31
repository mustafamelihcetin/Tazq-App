import React from 'react';
import { render } from '@testing-library/react-native';
import { MomentumPulse } from '@/features/user/components/MomentumPulse';

// Küre Skia çiziyor (test taklidinde `mix` yok); burada sınanan kartın yükleme davranışı.
jest.mock('@/features/user/components/MomentumOrb', () => ({ MomentumOrb: () => null }));

/**
 * MOMENTUM YENİLEMEDE KAYBOLMUYOR (2026-10-31).
 *
 * `useWeeklyStats` ekrana HER dönüşte `loading=true` yapıyor. Kart her seferinde boş bir
 * kutuya dönüp yeniden mount ediliyordu: ekran zıplıyor, sayı 0'dan sayıyor, küre baştan
 * üç nefes alıyordu. Yer tutucu yalnız İLK yüklemede; sonrası eldeki veriyle yerinde güncellenir.
 */
const history = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${20 + i}`, score: 40 + i }));
const props = { score: 62, history, language: 'tr' };

describe('MomentumPulse — yükleniyor durumu', () => {
  it('ilk yüklemede iskelet var, içerik yok', () => {
    const r = render(<MomentumPulse {...props} loading embedded />);
    expect(r.queryByText('MOMENTUM')).toBeNull();
    expect(r.getByTestId('momentum-skeleton')).toBeTruthy();
  });

  it('bir kez yüklendikten sonra yeniden yükleme içeriği SİLMEZ', () => {
    const r = render(<MomentumPulse {...props} loading={false} embedded />);
    expect(r.getByText('MOMENTUM')).toBeTruthy();
    r.rerender(<MomentumPulse {...props} loading embedded />);
    expect(r.getByText('MOMENTUM')).toBeTruthy();
    expect(r.queryByTestId('momentum-skeleton')).toBeNull();
  });

  it('en iyi gün parıltısı sonsuz döngüde değil', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../features/user/components/MomentumPulse.tsx'), 'utf8');
    expect(src).not.toMatch(/loop:\s*true/);
  });
});

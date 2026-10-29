/**
 * Madde 7 — mod durum rozeti ve yol haritası için faz modeli.
 * Sınav: motorun kendi 5 fazı (examPresets.getPhase) — iki kaynak olmasın.
 * Tarihli diğer modlar: kalan güne göre 4 faz. Süresizler: faz yok.
 */
import { modePhase } from '@/features/modes/utils/modePhase';

describe('modePhase', () => {
  it('sınav fazı motorla aynı kaynaktan', () => {
    expect(modePhase('exam', 300)).toMatchObject({ index: 0, total: 5, tr: 'Temel İnşa' });
    expect(modePhase('exam2', 20)).toMatchObject({ index: 4, total: 5, tr: 'Son Sprint' });
  });

  it('tez/mülakat/spor: kalan güne göre dört faz', () => {
    expect(modePhase('tez', 90)).toMatchObject({ index: 0, total: 4, tr: 'Hazırlık' });
    expect(modePhase('mulakat2', 45)).toMatchObject({ index: 1, total: 4, tr: 'Gelişim' });
    expect(modePhase('spor', 14)).toMatchObject({ index: 2, total: 4, tr: 'Yoğunlaşma' });
    expect(modePhase('spor3', 3)).toMatchObject({ index: 3, total: 4, tr: 'Son Düzlük' });
  });

  it('süresiz ya da tarihi geçmiş modda faz yok', () => {
    expect(modePhase('ramazan', null)).toBeNull();
    expect(modePhase('tasarruf', null)).toBeNull();
    expect(modePhase('tez', -1)).toBeNull();
  });

  it('her fazın iki dilli adı var', () => {
    const p = modePhase('exam', 100)!;
    expect(p.en).toBeTruthy();
    expect(p.names).toHaveLength(5);
  });
});

import { renderHook } from '@testing-library/react-native';
import { noteSeen, resetSeen } from '@/shared/utils/seenValues';
import { useSeenChange } from '@/shared/hooks/useSeenChange';

/**
 * SON GÖRÜLEN DEĞER (B1/B3, 2026-10-31) — "ne değişti" sorusunun tek cevabı.
 *
 * Değerler zaten tek motordan geliyor (bkz. planProgress.modeToday); ayrı bir "etki hesabı"
 * aynı sayımı ikinci kez yapardı. Bunun yerine her sayı, en son GÖRÜLDÜĞÜ değeri hatırlar:
 *  · from  → sekmeye dönünce sayı eski değerden yenisine akar (B3). Değişmediyse boş: sahte sayım yok.
 *  · delta → son değişimin farkı; "+1" (B2) bunu gösterir.
 * Bellek OTURUMLUK (diske yazılmaz): ertesi gün açılışta dünkü değerden akış yanlış bir "değişim" anlatır.
 */
describe('noteSeen', () => {
  beforeEach(() => resetSeen());

  it('önceki görülen değeri döndürür ve yenisini kaydeder', () => {
    expect(noteSeen('a', 1)).toBeUndefined();
    expect(noteSeen('a', 3)).toBe(1);
    expect(noteSeen('a', 3)).toBe(3);
    expect(noteSeen('b', 0)).toBeUndefined();
  });
});

describe('useSeenChange', () => {
  beforeEach(() => resetSeen());

  it('ilk görüşte akış ve fark yok', () => {
    const { result } = renderHook(() => useSeenChange('k', 2));
    expect(result.current).toEqual({ from: undefined, delta: 0 });
  });

  it('ekrandayken değer artınca fark görünür', () => {
    const { result, rerender } = renderHook(({ v }) => useSeenChange('k', v), { initialProps: { v: 2 } });
    rerender({ v: 3 });
    expect(result.current.delta).toBe(1);
  });

  it('başka sekmeden dönünce (yeniden kurulum) eski değerden akar', () => {
    const first = renderHook(() => useSeenChange('k', 2));
    first.unmount();
    const { result } = renderHook(() => useSeenChange('k', 5));
    expect(result.current).toEqual({ from: 2, delta: 3 });
  });

  it('değişmediyse dönüşte akış yok (her açılışta sahte sayım olmaz)', () => {
    renderHook(() => useSeenChange('k', 4)).unmount();
    const { result } = renderHook(() => useSeenChange('k', 4));
    expect(result.current).toEqual({ from: undefined, delta: 0 });
  });

  it('anahtarsız kullanım hiçbir şey hatırlamaz', () => {
    renderHook(() => useSeenChange(undefined, 4)).unmount();
    const { result } = renderHook(() => useSeenChange(undefined, 9));
    expect(result.current).toEqual({ from: undefined, delta: 0 });
  });
});

/** B3 bağlantıları: sekmeye dönünce akan sayılar (değişmediyse durur). */
it('sayılar son görülenden akar: Günün saatleri, Hedefler bugün, Mod özeti, momentum', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  expect(read('shared/components/DisplayPanel.tsx')).toContain('const seen = useSeenChange(lead ? seenKey : undefined');
  expect(read('app/gun.tsx')).toContain("seenKey={isToday ? 'day.done' : undefined}");
  expect(read('features/modes/components/ModeStatusCard.tsx')).toContain('seenKey="goals.today"');
  expect(read('app/mod-ozet.tsx')).toContain('seenKey="modes.week"');
  expect(read('features/user/components/MomentumPulse.tsx')).toContain('from={first ? 0 : seenScore.from}');
});

import { awaySentence } from '@/features/dashboard/utils/awaySentence';

/**
 * "SEN YOKKEN" (B5, 2026-10-31) — 2 günden uzun aradan sonra açılışta, selamın yerinde TEK satır.
 * Geri dönüş anlamlı olsun ama suçlamasın: "gecikmiş" değil "bekliyor"; ünlem yok, sayı yalnız ölçülen.
 * Gün sayımı TAKVİM günüdür (gece yarısını geçen kısa ara "1 gün" değildir, saat farkı değil gün farkı).
 */
describe('awaySentence', () => {
  const now = new Date(2026, 10, 1, 9, 0);
  const at = (y: number, m: number, d: number, h = 20) => new Date(y, m, d, h, 0).toISOString();

  it('2 günden kısa arada cümle yok', () => {
    expect(awaySentence({ lastOpen: at(2026, 9, 31), now, waiting: 4, lang: 'tr' })).toBeNull();
    expect(awaySentence({ lastOpen: at(2026, 10, 1, 7), now, waiting: 4, lang: 'tr' })).toBeNull();
  });

  it('ilk açılışta (kayıt yok) cümle yok', () => {
    expect(awaySentence({ lastOpen: null, now, waiting: 4, lang: 'tr' })).toBeNull();
  });

  it('gün · en yakın hedef · bekleyen iş', () => {
    expect(awaySentence({ lastOpen: at(2026, 9, 29), now, goal: { label: 'KPSS', days: 39 }, waiting: 4, lang: 'tr' }))
      .toBe('3 gün geçti · KPSS için 39 gün · 4 iş bekliyor');
    expect(awaySentence({ lastOpen: at(2026, 9, 29), now, goal: { label: 'KPSS', days: 39 }, waiting: 1, lang: 'en' }))
      .toBe('3 days since your last visit · 39 days to KPSS · 1 task waiting');
  });

  it('hedef ya da bekleyen iş yoksa o parça düşer', () => {
    expect(awaySentence({ lastOpen: at(2026, 9, 25), now, waiting: 0, lang: 'tr' })).toBe('7 gün geçti');
    expect(awaySentence({ lastOpen: at(2026, 9, 29), now, goal: { label: 'Tez', days: 0 }, waiting: 2, lang: 'tr' }))
      .toBe('3 gün geçti · Tez bugün · 2 iş bekliyor');
  });

  it('bozuk kayıt sessizce yok sayılır', () => {
    expect(awaySentence({ lastOpen: 'bozuk', now, waiting: 1, lang: 'tr' })).toBeNull();
  });
});

describe('nearestGoal', () => {
  const { nearestGoal } = require('@/features/dashboard/utils/awaySentence');
  const base = {
    examMode: false, examName: '', examDate: null, tezMode: false, tezName: '', tezDate: null,
    mulakatMode: false, mulakatName: '', mulakatDate: null, sporMode: false, sporGoal: '', sporDate: null,
    tasarrufMode: false, tasarrufName: '', tasarrufDate: null,
  };
  const now = new Date(2026, 10, 1, 9, 0);

  it('açık modlardan en yakın, geçmemiş tarihli olanı; ad yoksa genel ad', () => {
    expect(nearestGoal({ ...base, examMode: true, examName: 'KPSS', examDate: '2026-12-10', tezMode: true, tezDate: '2026-11-20' }, 'tr', now))
      .toEqual({ label: 'Tez', days: 19 });
  });

  it('geçmiş tarih ve kapalı mod sayılmaz; hiç yoksa undefined', () => {
    expect(nearestGoal({ ...base, examMode: true, examDate: '2026-10-01', tezDate: '2026-11-05' }, 'tr', now)).toBeUndefined();
  });
});

describe('useAwayLine', () => {
  const { renderHook, waitFor } = require('@testing-library/react-native');
  // Her test yeni bir açılış: kancanın oturum belleği sıfırlanır.
  const fresh = () => {
    const storage = require('@react-native-async-storage/async-storage').default;
    const { useAwayLine, resetAwayLineSession } = require('@/features/dashboard/hooks/useAwayLine');
    resetAwayLineSession();
    return { storage, useAwayLine };
  };

  it('önceki açılışı okur, şimdiyi yazar; 2+ gün arada satırı verir', async () => {
    const { storage, useAwayLine } = fresh();
    await storage.setItem('tazq.lastOpen.v1', new Date(Date.now() - 5 * 86400000).toISOString());
    const { result } = renderHook(() => useAwayLine('tr', 2));
    await waitFor(() => expect(result.current).toMatch(/^5 gün geçti · (.* · )?2 iş bekliyor$/));
    const written = await storage.getItem('tazq.lastOpen.v1');
    expect(Date.now() - new Date(written).getTime()).toBeLessThan(60000);
  });

  it('ilk açılışta satır yok, ama şimdi yazılır', async () => {
    const { storage, useAwayLine } = fresh();
    await storage.removeItem('tazq.lastOpen.v1');
    const { result } = renderHook(() => useAwayLine('tr', 2));
    await waitFor(async () => expect(await storage.getItem('tazq.lastOpen.v1')).not.toBeNull());
    expect(result.current).toBeNull();
  });
});

it('ana sayfada satır selamın YERİNE geçer (üst üste binmez)', () => {
  const src = (require('fs').readFileSync(require('path').join(__dirname, '..', 'app/index.tsx'), 'utf8') + require('fs').readFileSync(require('path').join(__dirname, '..', 'features/dashboard/hooks/useHomeModel.tsx'), 'utf8'));
  expect(src).toContain('const awayLine = useAwayLine(');
  expect(src).toMatch(/greeting=\{awayLine \?\? /);
});

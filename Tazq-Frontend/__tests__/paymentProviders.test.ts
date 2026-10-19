import { PAYMENT_PROVIDERS, matchProvider, searchProviders } from '@/shared/utils/paymentProviders';

describe('paymentProviders', () => {
  it('no duplicate ids', () => {
    const ids = PAYMENT_PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matchProvider finds an exact name match, case/diacritic-insensitive', () => {
    expect(matchProvider('İGDAŞ')?.id).toBe('igdas');
    expect(matchProvider('igdas')?.id).toBe('igdas');
    expect(matchProvider('IGDAS')?.id).toBe('igdas');
  });

  it('matchProvider finds an alias match', () => {
    expect(matchProvider('türk telekom')?.id).toBe('turk-telekom');
    expect(matchProvider('Disney Plus')?.id).toBe('disney-plus');
  });

  it('matchProvider returns null for unknown input', () => {
    expect(matchProvider('tamamen rastgele bir metin')).toBeNull();
    expect(matchProvider('')).toBeNull();
  });

  it('searchProviders returns partial matches while typing', () => {
    const results = searchProviders('turk');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(p => p.id === 'turkcell' || p.id === 'turk-telekom')).toBe(true);
  });

  it('searchProviders returns empty for very short input', () => {
    expect(searchProviders('t')).toEqual([]);
    expect(searchProviders('')).toEqual([]);
  });

  it('searchProviders puts an exact match first', () => {
    const results = searchProviders('netflix');
    expect(results[0].id).toBe('netflix');
  });

  it('searchProviders respects the limit', () => {
    const results = searchProviders('ne', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('searchProviders ranks a prefix match above a mere "contains" match', () => {
    // "net" bir ÖNEKTİR "Netflix"te, ama "İnternet" GİBİ bir alias/isim içinde
    // yalnız GEÇİYOR olsaydı — prefix öncelikli çıkmalı. Burada gerçek veri setinde
    // "net" hem Netflix'in (prefix) hem Türknet'in (içinde geçen) içinde var;
    // Netflix önde olmalı.
    const results = searchProviders('net');
    const netflixIdx = results.findIndex(p => p.id === 'netflix');
    const turknetIdx = results.findIndex(p => p.id === 'turknet');
    expect(netflixIdx).toBeGreaterThanOrEqual(0);
    if (turknetIdx >= 0) expect(netflixIdx).toBeLessThan(turknetIdx);
  });
});

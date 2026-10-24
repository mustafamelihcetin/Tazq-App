/**
 * Dile göre büyük harf — `toUpperCase()` Türkçe'yi bozar ("Eki" → "EKI",
 * "Bitiş tarihi" → "BITIŞ TARIHI"). Bkz. __tests__/localeUpperCase.test.ts.
 *
 * `tr` boolean ya da dil kodu alır ki çağıran yerde ayrıca `tr ? 'tr-TR' : 'en-US'`
 * dallanması yazılmasın (i18nRatchet).
 */
export const upperFor = (s: string, tr: boolean | string): string =>
  s.toLocaleUpperCase(tr === true || tr === 'tr' ? 'tr-TR' : 'en-US');

/**
 * Para birimi — TEK global kullanıcı tercihi (ödeme başına DEĞİL).
 *
 * NEDEN TEK TERCİH: uygulama Türkiye'de daha çok indirilse de arayüzü İngilizce de
 * sunuyor (global kullanıcı var) — ₺'yi sabit basmak yanlış. Ödeme başına farklı para
 * birimi (kur çevrimi, canlı kur API'si) gerçek bir karmaşıklık getirir ve bu özelliğin
 * ihtiyacı değil: kullanıcının TEK bir ana para birimi var, hepsini onunla takip eder
 * (hemen her bütçe uygulamasının yaptığı gibi). Bu yüzden `usePaymentsStore.currency`
 * tek bir global alan — her ödeme kaydında tekrarlanmaz.
 */
export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  labelTr: string;
  labelEn: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'TRY', symbol: '₺', labelTr: 'Türk Lirası', labelEn: 'Turkish Lira' },
  { code: 'USD', symbol: '$', labelTr: 'Amerikan Doları', labelEn: 'US Dollar' },
  { code: 'EUR', symbol: '€', labelTr: 'Euro', labelEn: 'Euro' },
  { code: 'GBP', symbol: '£', labelTr: 'İngiliz Sterlini', labelEn: 'British Pound' },
];

/**
 * Hiç seçim yapılmamışsa dil bazlı akla yakın varsayım — TR arayüz → TRY, diğerleri → USD.
 * Eşleme bir tabloda, dallanma yok (bkz. __tests__/i18nRatchet.test.ts — `lang === 'tr' ?`
 * kalıbı yeni dosyalarda yasak).
 */
const DEFAULT_CURRENCY_BY_LANG: Record<'tr' | 'en', CurrencyCode> = { tr: 'TRY', en: 'USD' };
export function defaultCurrencyFor(lang: 'tr' | 'en'): CurrencyCode {
  return DEFAULT_CURRENCY_BY_LANG[lang];
}

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? '₺';
}

export function currencyLabel(code: CurrencyCode, tr: boolean): string {
  const c = CURRENCIES.find(c => c.code === code);
  if (!c) return code;
  return tr ? c.labelTr : c.labelEn;
}

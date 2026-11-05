import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { currencySymbol, defaultCurrencyFor, type CurrencyCode } from '@/shared/utils/currency';

/*
  TEK PARA BİRİMİ (2026-11-05, kullanıcı: "İngilizcede hep ₺"). Ödemeler zaten global bir tercih tutuyor; bütçe de onu okur. Seçim yoksa dile göre varsayım.
  Yalnız simgedir, kur çevrimi yapılmaz: kullanıcının tuttuğu sayı onun sayısıdır (bkz. shared/utils/currency).
*/
export function useMoneySymbol(lang: 'tr' | 'en'): { code: CurrencyCode; symbol: string } {
  const code = usePaymentsStore(s => s.currency) ?? defaultCurrencyFor(lang);
  return { code, symbol: currencySymbol(code) };
}

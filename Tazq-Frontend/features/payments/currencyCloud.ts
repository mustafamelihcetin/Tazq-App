/**
 * Para birimi tercihinin buluta taşınması.
 *
 * Tercih yalnız AsyncStorage'daydı: yeni cihaz / ayrı paket (dev sürüm) boş görüp
 * dil varsayımına (TR → ₺) düşüyordu — "$24" girilen ödeme "24 ₺" görünüyordu.
 * Taşıyıcı tercih snapshot'ı (`__currency`); kural offline-first: yerel seçim
 * otoriter, bulut yalnız boş yereli doldurur.
 */

import { usePaymentsStore } from './store/usePaymentsStore';
import { CURRENCIES, type CurrencyCode } from '@/shared/utils/currency';

const isCurrency = (v: unknown): v is CurrencyCode =>
  typeof v === 'string' && CURRENCIES.some(c => c.code === v);

/** Snapshot'a eklenecek alan (seçim yoksa hiçbir şey). */
export function currencySnapshot(): { __currency?: CurrencyCode } {
  const cur = usePaymentsStore.getState().currency;
  return cur ? { __currency: cur } : {};
}

/**
 * Buluttan gelen değeri uygular.
 * @returns Yerel seçim buluta hiç ulaşmamışsa `true` — çağıran yeniden göndermeli.
 */
export function applyCloudCurrency(cloud: unknown): boolean {
  const local = usePaymentsStore.getState().currency;
  if (!local) {
    // setState, setCurrency değil: buluttan geleni buluta geri göndermeye gerek yok.
    if (isCurrency(cloud)) usePaymentsStore.setState({ currency: cloud });
    return false;
  }
  return cloud !== local;
}

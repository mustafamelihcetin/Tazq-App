/**
 * ÇOK BİRİMLİ ÖDEME HESAPLARI (madde 12) — saf fonksiyonlar.
 *
 * Kural (kullanıcı kararı 2026-10-29): kesin toplamlar BİRİM BİRİM gösterilir
 * ("250 ₺ · 20 $ · 100 €"); altında ana birimde YAKLAŞIK tek toplam (günlük ECB kuru).
 * Kur yoksa ya da bir birimin kuru eksikse yaklaşık değer HESAPLANMAZ (null) — eski ya
 * da uydurma bir kurla yanlış rakamı doğru gibi göstermek, hiç göstermemekten kötüdür.
 */
import { currencySymbol, type CurrencyCode } from '@/shared/utils/currency';

export interface FxRates { date: string; base: string; rates: Record<string, number> }
export interface Total { code: string; amount: number }

const LOCALE = { tr: 'tr-TR', en: 'en-US' } as const;

export function totalsByCurrency(items: Array<{ amount: number; currency?: string | null }>, main: string): Total[] {
  const map = new Map<string, number>([[main, 0]]);
  for (const it of items) {
    const code = it.currency || main;
    map.set(code, (map.get(code) ?? 0) + it.amount);
  }
  return [...map.entries()].filter(([code, amount]) => amount !== 0 || code === main && map.size === 1).map(([code, amount]) => ({ code, amount }));
}

export function formatMoney(amount: number, code: string, lang: 'tr' | 'en'): string {
  return `${amount.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 })} ${currencySymbol(code as CurrencyCode)}`;
}

export function formatTotals(totals: Total[], lang: 'tr' | 'en'): string {
  return totals.map(t => formatMoney(t.amount, t.code, lang)).join(' · ');
}

/** `from` biriminden `to` birimine (EUR tabanlı çapraz kur). Kur eksikse null. */
function convert(amount: number, from: string, to: string, fx: FxRates | null): number | null {
  if (from === to) return amount;
  const a = fx?.rates[from];
  const b = fx?.rates[to];
  return a && b ? (amount / a) * b : null;
}

export function approxTotal(totals: Total[], main: string, fx: FxRates | null): number | null {
  let sum = 0;
  for (const t of totals) {
    const v = convert(t.amount, t.code, main, fx);
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/**
 * Geçmiş kaydı OLMAYAN "ödendi" işaretlerini geçmişe katar (madde 12 düzeltmesi).
 * Geçmiş tablosundan önce işaretlenen ya da henüz sunucuya ulaşmamış ödemeler yalnız
 * `lastPaidCycleKey` taşır; grafik bunları görmeyince Ekim boş çiziliyordu. Gerçek an
 * bilinmez → dönemin vade günü (gelecekteyse şimdi); sunucu da aynı kuralla doldurur
 * (PaymentService.EstimatePaidAt), kayıt gelince ödeme+dönem eşleşmesiyle tekilleşir.
 */
export function withLocalPaid<R extends { paymentId?: number | null; cycleKey: string; paidAt: string }>(
  history: R[],
  payments: Array<{ id: number; title: string; amount: number; dueDay: number; currency?: string | null; nextDueDate?: string | null; lastPaidCycleKey?: string | null }>,
  now: Date = new Date(),
): Array<R | { id: number; paymentId: number; title: string; amount: number; currency?: string | null; cycleKey: string; paidAt: string }> {
  const seen = new Set(history.map(r => `${r.paymentId}|${r.cycleKey}`));
  const extra = payments.filter(p => p.lastPaidCycleKey && !seen.has(`${p.id}|${p.lastPaidCycleKey}`)).map(p => {
    const key = p.lastPaidCycleKey!;
    const [y, m] = key.split('-').map(Number);
    let at = /^\d{4}-\d{2}$/.test(key) ? new Date(y, m - 1, Math.min(Math.max(p.dueDay, 1), new Date(y, m, 0).getDate()), 12)
      : /^\d{4}$/.test(key) ? new Date(y, 0, 1, 12)
      : p.nextDueDate ? new Date(p.nextDueDate) : now;
    if (at > now) at = now;
    return { id: -p.id, paymentId: p.id, title: p.title, amount: p.amount, currency: p.currency, cycleKey: key, paidAt: at.toISOString() };
  });
  return extra.length ? [...history, ...extra].sort((a, b) => b.paidAt.localeCompare(a.paidAt)) : history;
}

export interface MonthBucket { key: string; amount: number; partial: boolean }

/**
 * Son `months` ayın ödenen tutarı, ana birimde, eskiden yeniye (grafik için).
 * Kur yoksa yabancı birimli kayıtlar o aya eklenemez → ay `partial` işaretlenir; grafik
 * bunu "eksik" diye gösterir, toplamı olduğundan küçük ama doğruymuş gibi çizmez.
 */
export function monthlyPaid(
  records: Array<{ paidAt: string; amount: number; currency?: string | null }>,
  months: number,
  main: string,
  fx: FxRates | null,
  now: Date = new Date(),
): MonthBucket[] {
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) buckets.push({ key: keyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)), amount: 0, partial: false });
  const byKey = new Map(buckets.map(b => [b.key, b]));
  for (const r of records) {
    const b = byKey.get(keyOf(new Date(r.paidAt)));
    if (!b) continue;
    const v = convert(r.amount, r.currency || main, main, fx);
    if (v == null) b.partial = true;
    else b.amount += v;
  }
  return buckets;
}

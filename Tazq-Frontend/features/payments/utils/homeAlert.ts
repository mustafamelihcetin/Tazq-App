import type { Payment } from '@/features/payments/store/usePaymentsStore';
import { paymentView } from '@/features/payments/utils/paymentDates';

/*
  ANA SAYFA YALNIZ BUGÜNÜN İŞİNİ SÖYLER (2026-11-06). Gecikmiş ve bugün son günü olan ödeme burada; 3 gün içindekiler gelen kutusunda
  (bkz. inboxItems). Gelen kutusuyla aynı motor: iki yüzey aynı ödemeye farklı durum diyemez.
*/
export interface HomePaymentAlert {
  overdue: boolean;
  payments: Payment[];
}

export function homePaymentAlert(payments: Payment[], now: Date = new Date()): HomePaymentAlert | null {
  const views = payments
    .map(p => paymentView(p, now))
    .filter((v): v is NonNullable<typeof v> => v != null && v.status !== 'paid');
  const overdue = views.filter(v => v.status === 'overdue');
  const relevant = overdue.length > 0 ? overdue : views.filter(v => v.days === 0);
  if (relevant.length === 0) return null;
  return { overdue: overdue.length > 0, payments: relevant.map(v => v.p) };
}

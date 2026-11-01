import { installmentNo, paymentView } from '@/features/payments/utils/paymentDates';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

/*
  TAKSİT + DEĞİŞKEN TUTAR (2026-11-01): kaçıncı taksit, son taksitten sonra ödeme kapanır.
*/
const base: Payment = { id: 1, title: 'Telefon', amount: 1000, dueDay: 10, recurrence: 'Monthly', installmentCount: 3, installmentStart: '2026-10' };

describe('taksit', () => {
  it('dönemin kaçıncı taksit olduğu (aylık ve yıllık)', () => {
    expect(installmentNo(base, '2026-10')).toBe(1);
    expect(installmentNo(base, '2026-12')).toBe(3);
    expect(installmentNo(base, '2027-01')).toBe(4);
    expect(installmentNo({ ...base, recurrence: 'Yearly', installmentStart: '2026' }, '2028')).toBe(3);
    expect(installmentNo({ ...base, installmentCount: null }, '2026-10')).toBeNull();
  });

  it('satır taksit numarasını taşır; son taksit ödenince ödeme kapanır', () => {
    const v = paymentView(base, new Date(2026, 10, 5)); // 5 Kasım → 2. taksit
    expect(v?.installment).toEqual({ no: 2, total: 3 });
    const lastPaid = { ...base, lastPaidCycleKey: '2026-12' };
    expect(paymentView(lastPaid, new Date(2026, 11, 20))?.status).toBe('paid'); // Aralık: ödendi olarak kalır
    expect(paymentView(lastPaid, new Date(2027, 0, 5))).toBeNull();             // Ocak: bitti
  });
});

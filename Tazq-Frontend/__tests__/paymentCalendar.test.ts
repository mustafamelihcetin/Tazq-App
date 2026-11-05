import { occurrenceInMonth } from '@/features/payments/utils/paymentDates';
import { monthGrid } from '@/shared/components/MonthCalendar';
import { paymentLook, reminderDaysOf } from '@/features/payments/utils/paymentLook';
import { compactAmount } from '@/features/payments/components/PaymentsCalendar';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

const base: Payment = { id: 1, title: 'Kira', amount: 100, dueDay: 31, recurrence: 'Monthly' };
const today = new Date(2026, 10, 5);

describe('ödeme takvimi', () => {
  it('aylık: ay kısaysa son gün', () => {
    expect(occurrenceInMonth(base, 2027, 1, today)?.date.getDate()).toBe(28);
  });
  it('tek seferlik yalnız kendi ayında', () => {
    const once: Payment = { ...base, recurrence: 'Once', nextDueDate: new Date(2026, 11, 17).toISOString() };
    expect(occurrenceInMonth(once, 2026, 11, today)?.date.getDate()).toBe(17);
    expect(occurrenceInMonth(once, 2026, 10, today)).toBeNull();
  });
  it('yıllık: yalnız o ay, ilk yıldan önce yok', () => {
    const y: Payment = { ...base, recurrence: 'Yearly', nextDueDate: new Date(2027, 2, 10).toISOString() };
    expect(occurrenceInMonth(y, 2026, 2, today)).toBeNull();
    expect(occurrenceInMonth(y, 2028, 2, today)?.date.getFullYear()).toBe(2028);
    expect(occurrenceInMonth(y, 2027, 3, today)).toBeNull();
  });
  it('taksit bitince ve başlamadan önce görünmez', () => {
    const t: Payment = { ...base, dueDay: 5, installmentCount: 2, installmentStart: '2026-11' };
    expect(occurrenceInMonth(t, 2026, 9, today)).toBeNull();
    expect(occurrenceInMonth(t, 2026, 11, today)?.installment).toEqual({ no: 2, total: 2 });
    expect(occurrenceInMonth(t, 2027, 0, today)).toBeNull();
  });
  it('geçmiş ay için ödendi/gecikti uydurulmaz', () => {
    expect(occurrenceInMonth({ ...base, dueDay: 5 }, 2026, 8, today)?.status).toBe('past');
  });
  it('ödendi ve gecikti ayrımı', () => {
    expect(occurrenceInMonth({ ...base, dueDay: 2, lastPaidCycleKey: '2026-11' }, 2026, 10, today)?.status).toBe('paid');
    expect(occurrenceInMonth({ ...base, dueDay: 2 }, 2026, 10, today)?.status).toBe('overdue');
    expect(occurrenceInMonth({ ...base, dueDay: 20 }, 2026, 10, today)?.status).toBe('due');
  });
  it('ay ızgarası pazartesi başlar ve hafta tamdır', () => {
    const g = monthGrid(2026, 10); // 1 Kasım 2026 pazar
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe('2026-11-01');
    expect(g.every(r => r.length === 7)).toBe(true);
  });
  it('görünüm: kullanıcı seçimi tahminden önce gelir; hatırlatma varsayılanı 3', () => {
    expect(paymentLook({ title: 'x', icon: null, color: '#123456' }).color).toBe('#123456');
    expect(reminderDaysOf({})).toBe(3);
    expect(reminderDaysOf({ reminderDays: -1 })).toBe(-1);
  });
});

it('hücre için kısa tutar', () => {
  expect(compactAmount(1500, 'tr')).toBe('1,5B');
  expect(compactAmount(1500, 'en')).toBe('1.5K');
  expect(compactAmount(850, 'tr')).toBe('850');
  expect(compactAmount(2000000, 'tr')).toBe('2M');
});

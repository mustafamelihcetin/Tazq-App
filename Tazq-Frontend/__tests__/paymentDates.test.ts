import { nextDueDateOf, cycleKeyOf, isPaidForCycle, activeCycleKeyOf, paymentView } from '@/features/payments/utils/paymentDates';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

function makePayment(overrides: Partial<Payment>): Payment {
  return {
    id: 1,
    title: 'Test',
    amount: 100,
    dueDay: 15,
    recurrence: 'Monthly',
    nextDueDate: null,
    lastPaidCycleKey: null,
    category: null,
    ...overrides,
  };
}

describe('nextDueDateOf — Monthly', () => {
  it('returns this month if unpaid', () => {
    const p = makePayment({ dueDay: 15 });
    const today = new Date(2026, 5, 1); // 2026-06-01
    const due = nextDueDateOf(p, today);
    expect(due?.getFullYear()).toBe(2026);
    expect(due?.getMonth()).toBe(5);
    expect(due?.getDate()).toBe(15);
  });

  it('rolls to next month if this month already paid', () => {
    const today = new Date(2026, 5, 20); // 2026-06-20
    const p = makePayment({ dueDay: 15, lastPaidCycleKey: '2026-06' });
    const due = nextDueDateOf(p, today);
    expect(due?.getMonth()).toBe(6); // July
    expect(due?.getDate()).toBe(15);
  });

  it('clamps dueDay to the last day of short months', () => {
    const today = new Date(2026, 1, 10); // 2026-02-10 (2026 is not a leap year)
    const p = makePayment({ dueDay: 31 });
    const due = nextDueDateOf(p, today);
    expect(due?.getMonth()).toBe(1);
    expect(due?.getDate()).toBe(28);
  });

  it('rolls over year boundary (December paid → January)', () => {
    const today = new Date(2026, 11, 20); // 2026-12-20
    const p = makePayment({ dueDay: 15, lastPaidCycleKey: '2026-12' });
    const due = nextDueDateOf(p, today);
    expect(due?.getFullYear()).toBe(2027);
    expect(due?.getMonth()).toBe(0);
    expect(due?.getDate()).toBe(15);
  });
});

describe('nextDueDateOf — Yearly', () => {
  it('uses the month/day of nextDueDate, in the current year', () => {
    const p = makePayment({ recurrence: 'Yearly', nextDueDate: '2020-03-10T00:00:00.000Z' });
    const today = new Date(2026, 5, 1);
    const due = nextDueDateOf(p, today);
    expect(due?.getMonth()).toBe(2); // March (UTC date parsed locally may shift; month 2 = March)
    expect(due?.getFullYear()).toBe(2026);
  });

  it('rolls to next year if this year already paid', () => {
    const p = makePayment({ recurrence: 'Yearly', nextDueDate: '2020-03-10T00:00:00.000Z', lastPaidCycleKey: '2026' });
    const today = new Date(2026, 5, 1);
    const due = nextDueDateOf(p, today);
    expect(due?.getFullYear()).toBe(2027);
  });
});

describe('nextDueDateOf — Once', () => {
  it('returns the exact date while unpaid', () => {
    const p = makePayment({ recurrence: 'Once', nextDueDate: '2026-08-01T00:00:00.000Z' });
    const due = nextDueDateOf(p, new Date(2026, 5, 1));
    expect(due).not.toBeNull();
  });

  it('returns null once paid (no further occurrences)', () => {
    const p = makePayment({ recurrence: 'Once', nextDueDate: '2026-08-01T00:00:00.000Z', lastPaidCycleKey: 'once' });
    const due = nextDueDateOf(p, new Date(2026, 5, 1));
    expect(due).toBeNull();
  });
});

describe('cycleKeyOf / isPaidForCycle / activeCycleKeyOf', () => {
  it('formats monthly as YYYY-MM, yearly as YYYY, once as "once"', () => {
    const date = new Date(2026, 5, 15);
    expect(cycleKeyOf(makePayment({ recurrence: 'Monthly' }), date)).toBe('2026-06');
    expect(cycleKeyOf(makePayment({ recurrence: 'Yearly' }), date)).toBe('2026');
    expect(cycleKeyOf(makePayment({ recurrence: 'Once' }), date)).toBe('once');
  });

  it('isPaidForCycle matches exactly against lastPaidCycleKey', () => {
    const p = makePayment({ lastPaidCycleKey: '2026-06' });
    expect(isPaidForCycle(p, '2026-06')).toBe(true);
    expect(isPaidForCycle(p, '2026-07')).toBe(false);
  });

  it('activeCycleKeyOf matches what nextDueDateOf would use to mark paid', () => {
    const today = new Date(2026, 5, 1);
    const p = makePayment({ dueDay: 15 });
    expect(activeCycleKeyOf(p, today)).toBe('2026-06');
  });
});

describe('Yearly — ilk vade gelecek yıl', () => {
  it('Ekim\'de Mart 2027 seçilen yıllık ödeme bu yılın Mart\'ında gecikmiş SAYILMAZ', () => {
    const p = makePayment({ recurrence: 'Yearly', nextDueDate: new Date(2027, 2, 15).toISOString() });
    const due = nextDueDateOf(p, new Date(2026, 9, 24));
    expect(due?.getFullYear()).toBe(2027);
    expect(due?.getMonth()).toBe(2);
  });
});

describe('paymentView', () => {
  const today = new Date(2026, 9, 24); // 24 Ekim

  it('bu dönem ödenmiş aylık ödeme kendi ayında "ödendi" kalır (Kasım\'a kaymaz)', () => {
    const v = paymentView(makePayment({ dueDay: 1, lastPaidCycleKey: '2026-10' }), today);
    expect(v?.status).toBe('paid');
    expect(v?.thisMonth).toBe(true);
    expect(v?.date.getMonth()).toBe(9);
  });

  it('vadesi geçmiş ödenmemiş ödeme gecikmiş ve "bu ay"da', () => {
    const v = paymentView(makePayment({ dueDay: 2 }), today);
    expect(v?.status).toBe('overdue');
    expect(v?.days).toBe(-22);
    expect(v?.thisMonth).toBe(true);
  });

  it('yaklaşan ödeme gün farkıyla gelir', () => {
    const v = paymentView(makePayment({ dueDay: 27 }), today);
    expect(v).toMatchObject({ status: 'due', days: 3, thisMonth: true });
  });

  it('sonraki aydaki tek seferlik ödeme "bu ay" değil', () => {
    const v = paymentView(makePayment({ recurrence: 'Once', nextDueDate: new Date(2026, 10, 2).toISOString() }), today);
    expect(v).toMatchObject({ status: 'due', thisMonth: false });
  });

  it('ödenmiş tek seferlik ödeme gösterilmez', () => {
    const v = paymentView(makePayment({ recurrence: 'Once', nextDueDate: new Date(2026, 8, 2).toISOString(), lastPaidCycleKey: 'once' }), today);
    expect(v).toBeNull();
  });
});

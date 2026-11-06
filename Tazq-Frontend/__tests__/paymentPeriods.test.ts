import { activeCycleKeyOf, currentCycleDate, installmentNo, nextDueDateOf, occurrenceInMonth, paymentView } from '@/features/payments/utils/paymentDates';
import type { Payment } from '@/features/payments/store/usePaymentsStore';
import { goalCountsAsDone, habitAchievementIds } from '@/features/user/utils/achievements';

const pay = (o: Partial<Payment>): Payment => ({ id: 1, title: 'MTV', amount: 100, dueDay: 15, recurrence: 'SemiAnnual', nextDueDate: new Date(2027, 0, 15).toISOString(), category: null, lastPaidCycleKey: null, ...o } as Payment);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (x: Date | null) => x && `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;

describe('3 ve 6 aylık ödeme', () => {
  it('ilk vade gelecekteyse dönem odur, gecikmiş sayılmaz', () => {
    const v = paymentView(pay({}), d(2026, 11, 6))!;
    expect(ymd(v.date)).toBe('2027-1-15');
    expect(v.status).toBe('due');
    expect(v.thisMonth).toBe(false);
  });
  it('dönem içinde son tekrar geçerli; ödenmezse gecikir', () => {
    expect(ymd(currentCycleDate(pay({}), d(2027, 4, 1)))).toBe('2027-1-15');
    expect(paymentView(pay({}), d(2027, 4, 1))!.status).toBe('overdue');
    expect(ymd(currentCycleDate(pay({}), d(2027, 7, 1)))).toBe('2027-7-15');
  });
  it('ödenince sıradaki 6 ay sonra', () => {
    const p = pay({ lastPaidCycleKey: '2027-01' });
    expect(ymd(nextDueDateOf(p, d(2027, 2, 1)))).toBe('2027-7-15');
    expect(activeCycleKeyOf(p, d(2027, 2, 1))).toBe('2027-01');
  });
  it('3 aylık: ayın son günü kısa ayda taşmaz', () => {
    const p = pay({ recurrence: 'Quarterly', nextDueDate: new Date(2027, 0, 31).toISOString() });
    expect(ymd(currentCycleDate(p, d(2027, 4, 2)))).toBe('2027-4-30');
    expect(ymd(nextDueDateOf({ ...p, lastPaidCycleKey: '2027-04' }, d(2027, 4, 2)))).toBe('2027-7-31');
  });
  it('takvimde yalnız dönem aylarında görünür', () => {
    const p = pay({ recurrence: 'Quarterly' });
    expect(occurrenceInMonth(p, 2027, 3, d(2027, 1, 1))).not.toBeNull();
    expect(occurrenceInMonth(p, 2027, 4, d(2027, 1, 1))).toBeNull();
    expect(occurrenceInMonth(p, 2026, 9, d(2027, 1, 1))).toBeNull();
  });
  it('taksit numarası dönemle sayar', () => {
    const p = pay({ installmentCount: 4, installmentStart: '2027-01' });
    expect(installmentNo(p, '2027-07')).toBe(2);
    expect(installmentNo(p, '2028-07')).toBe(4);
  });
});

describe('yeni başarımlar', () => {
  it('alışkanlık eşikleri', () => {
    expect(habitAchievementIds(6)).toEqual([]);
    expect(habitAchievementIds(21)).toEqual(['habit_7', 'habit_21']);
  });
  it('erken kapanan hedef ödül değil', () => {
    expect(goalCountsAsDone({ targetKey: '2027-01-01', closedKey: '2026-11-06', days: 40 })).toBe(false);
    expect(goalCountsAsDone({ targetKey: '2026-11-01', closedKey: '2026-11-06', days: 5 })).toBe(true);
    expect(goalCountsAsDone({ targetKey: null, closedKey: '2026-11-06', days: 30 })).toBe(true);
    expect(goalCountsAsDone({ targetKey: null, closedKey: '2026-11-06', days: 3 })).toBe(false);
  });
});

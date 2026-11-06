import { reminderPlan, REMINDER_LIMIT } from '@/features/payments/paymentReminders';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

jest.mock('@/shared/utils/notifications', () => ({ syncPaymentDueNotifs: jest.fn() }));

const NOW = new Date(2026, 10, 6, 9, 0, 0);
const pay = (over: Partial<Payment> = {}): Payment => ({ id: 1, title: 'Kira', amount: 12000, dueDay: 20, recurrence: 'Monthly', ...over } as Payment);
const plan = (ps: Payment[], ledger = {}, now = NOW) => reminderPlan(ps, ledger, 'tr', 'TRY', now);

describe('ödeme hatırlatma planı', () => {
  it('vadeden N gün önce saat 10:00, metinde kalan gün ve tutar', () => {
    const { notifs } = plan([pay()]);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].fireAt).toEqual(new Date(2026, 10, 17, 10, 0, 0));
    expect(notifs[0].title).toBe('Kira ödemesi yaklaşıyor');
    expect(notifs[0].body).toContain('3 gün sonra');
    expect(notifs[0].body).toContain('12.000');
  });

  it('kapalı hatırlatma, sunucuya yazılmamış ve bitmiş ödeme kurulmaz', () => {
    expect(plan([pay({ reminderDays: -1 })]).notifs).toHaveLength(0);
    expect(plan([pay({ id: -5 })]).notifs).toHaveLength(0);
    expect(plan([pay({ recurrence: 'Once', nextDueDate: '2026-11-20T00:00:00', lastPaidCycleKey: 'once' })]).notifs).toHaveLength(0);
  });

  it('bu dönem ödendiyse sonraki dönem kurulur', () => {
    const { notifs } = plan([pay({ lastPaidCycleKey: '2026-11' })]);
    expect(notifs[0].fireAt).toEqual(new Date(2026, 11, 17, 10, 0, 0));
  });

  it('hatırlatma günü geçmişse vazgeçmez: en yakın 10:00, gerçek kalan gün', () => {
    const { notifs } = plan([pay({ dueDay: 8 })]); // 2 gün kaldı, 3 gün önce istenmiş
    expect(notifs[0].fireAt).toEqual(new Date(2026, 10, 6, 10, 0, 0));
    expect(notifs[0].body).toContain('2 gün sonra');
  });

  it('10:00 geçtiyse ertesi güne kurar; son gün için "bugün" der', () => {
    const late = new Date(2026, 10, 7, 15, 0, 0);
    const { notifs } = plan([pay({ dueDay: 8 })], {}, late);
    expect(notifs[0].fireAt).toEqual(new Date(2026, 10, 8, 10, 0, 0));
    expect(notifs[0].title).toBe('Kira ödemesi bugün');
    expect(notifs[0].body).toContain('Bugün son gün');
  });

  it('aynı vade için geç hatırlatma bir kez: her açılışta yeniden çalmaz', () => {
    const first = plan([pay({ dueDay: 8 })]);
    expect(first.notifs).toHaveLength(1);
    const next = plan([pay({ dueDay: 8 })], first.ledger, new Date(2026, 10, 7, 9, 0, 0));
    expect(next.notifs).toHaveLength(0);
    expect(next.ledger).toEqual(first.ledger);
  });

  it('vadesi yeni dönem olunca defter engel olmaz', () => {
    const first = plan([pay({ dueDay: 8 })]);
    const paid = plan([pay({ dueDay: 8, lastPaidCycleKey: '2026-11' })], first.ledger);
    expect(paid.notifs).toHaveLength(1);
    expect(paid.notifs[0].fireAt).toEqual(new Date(2026, 11, 5, 10, 0, 0));
  });

  it('değişken tutar tahmini söyler', () => {
    expect(plan([pay({ isVariable: true, amount: 650 })]).notifs[0].body).toContain('tahmini 650');
    expect(plan([pay({ isVariable: true, amount: 650 })]).notifs[0].variable).toBe(true);
  });

  it('en yakın ödemeler kurulur, sınır aşılmaz', () => {
    const many = Array.from({ length: REMINDER_LIMIT + 8 }, (_, i) => pay({ id: i + 1, recurrence: 'Yearly', nextDueDate: null, dueDay: 15 + (i % 10) }));
    const { notifs } = plan(many);
    expect(notifs).toHaveLength(REMINDER_LIMIT);
    const times = notifs.map((n) => n.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('İngilizce', () => {
    const { notifs } = reminderPlan([pay({ dueDay: 7 })], {}, 'en', 'USD', NOW);
    expect(notifs[0].body).toContain('Tomorrow');
  });
});

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { InboxSheet } from '@/features/dashboard/components/InboxSheet';
import type { InboxItem } from '@/features/dashboard/utils/inboxItems';
import { usePaymentsStore, type Payment } from '@/features/payments/store/usePaymentsStore';
import { canSkipCycle, markPaidUndoable, skipCycleUndoable } from '@/features/payments/utils/paymentActions';
import { paymentView, nextDueDateOf } from '@/features/payments/utils/paymentDates';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { Colors } from '@/shared/constants/Colors';
import { scheduleCommit, __resetCommitsForTests, UNDO_WINDOW_MS } from '@/shared/utils/deferredCommit';

const mockMarkPaid = jest.fn();
const mockSkip = jest.fn();
jest.mock('@/shared/services/api', () => ({
  PaymentService: {
    markPaid: (...a: unknown[]) => mockMarkPaid(...a),
    skipCycle: (...a: unknown[]) => mockSkip(...a),
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas', Path: 'Path', Group: 'Group', BlurMask: 'BlurMask',
  Skia: { Path: { Make: () => ({ moveTo() {}, quadTo() {}, close() {} }) } },
}));

const NOW = new Date(2026, 10, 6, 9);
const pay = (over: Partial<Payment> = {}) => ({ id: 3, title: 'Kira', amount: 100, dueDay: 8, recurrence: 'Monthly', ...over } as Payment);
const item = (over: Partial<InboxItem> = {}): InboxItem => ({ id: 'pay:3', kind: 'payment', rank: 1, title: 'Kira', sub: '2 gün sonra', ref: 3, ...over });
const theme = (Colors as unknown as { dark: never }).dark;
const hidden = { includeHiddenElements: true };

function sheet(props: Partial<React.ComponentProps<typeof InboxSheet>> = {}) {
  return (
    <InboxSheet visible onClose={() => {}} items={[item()]} zenCard={null} somedayCard={null} onItem={() => {}} onDismiss={() => {}} theme={theme} language="tr" {...props} />
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMarkPaid.mockResolvedValue(undefined);
  mockSkip.mockResolvedValue(undefined);
  __resetCommitsForTests();
  useNetworkStore.setState({ isOnline: true } as never);
  useOfflineQueue.setState({ ops: [] } as never);
  usePaymentsStore.setState({ payments: [pay()] });
});
afterEach(() => {
  __resetCommitsForTests();
  jest.useRealTimers();
});

const current = () => usePaymentsStore.getState().payments[0];

describe('gelen kutusundan ödeme', () => {
  it('dokununca tik çizilir, sonra ödenir; satır yerinde "Geri al" olur, süre bitince kapanır', () => {
    const undo = jest.fn(() => true);
    const onPay = jest.fn(() => undo);
    const ui = render(sheet({ onPay }));
    fireEvent.press(ui.getByLabelText('Ödendi işaretle: Kira', hidden));
    expect(onPay).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(300); });
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(ui.getByText('Kira ödendi', hidden)).toBeTruthy();
    act(() => { jest.advanceTimersByTime(UNDO_WINDOW_MS); });
    expect(ui.queryByText('Kira ödendi', hidden)).toBeNull();
  });

  it('geri alınca satır hemen açılır', () => {
    const undo = jest.fn(() => true);
    const ui = render(sheet({ onPay: () => undo }));
    fireEvent.press(ui.getByLabelText('Ödendi işaretle: Kira', hidden));
    act(() => { jest.advanceTimersByTime(300); });
    fireEvent.press(ui.getByLabelText('Geri al: Kira', hidden));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(ui.queryByText('Kira ödendi', hidden)).toBeNull();
    expect(ui.getByText('Kira', hidden)).toBeTruthy();
  });

  it('kalem listeden düşse de satır eski yerinde kalır', () => {
    const other = item({ id: 'pay:4', ref: 4, title: 'Su' });
    const ui = render(sheet({ items: [item(), other], onPay: () => () => true }));
    fireEvent.press(ui.getByLabelText('Ödendi işaretle: Kira', hidden));
    act(() => { jest.advanceTimersByTime(300); });
    ui.rerender(sheet({ items: [other], onPay: () => () => true }));
    expect(ui.getByText('Kira ödendi', hidden)).toBeTruthy();
    expect(ui.getByText('Su', hidden)).toBeTruthy();
  });

  it('değişken tutarlıda tik beklemeden çağıran devralır', () => {
    const onPay = jest.fn(() => null);
    const ui = render(sheet({ items: [item({ variable: true })], onPay }));
    fireEvent.press(ui.getByLabelText('Ödendi işaretle: Kira', hidden));
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(ui.queryByText('Kira ödendi', hidden)).toBeNull();
  });

  it('kimliksiz örnek kalemde daire yok', () => {
    const ui = render(sheet({ items: [item({ ref: undefined })], onPay: () => null }));
    expect(ui.queryByLabelText('Ödendi işaretle: Kira', hidden)).toBeNull();
  });

  it('boş kutuda yıldız', () => {
    expect(render(sheet({ items: [] })).getByTestId('inbox-empty-star', hidden)).toBeTruthy();
  });
});

describe('geri alınabilir ödendi', () => {
  it('süre dolunca gönderilir, geri alınca önceki dönem ve tutar aynen döner', () => {
    usePaymentsStore.setState({ payments: [pay({ lastPaidCycleKey: '2026-10', isVariable: true })] });
    const undo = markPaidUndoable(3, '2026-11', 250);
    expect(current()).toMatchObject({ lastPaidCycleKey: '2026-11', amount: 250 });
    expect(undo?.()).toBe(true);
    expect(current()).toMatchObject({ lastPaidCycleKey: '2026-10', amount: 100 });
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockMarkPaid).not.toHaveBeenCalled();

    markPaidUndoable(3, '2026-11', 250);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockMarkPaid).toHaveBeenCalledWith(3, '2026-11', 250);
  });

  it('tazeleme bekleyen işaretlemeyi ezmez', () => {
    markPaidUndoable(3, '2026-11');
    usePaymentsStore.getState().setPayments([pay()]);
    expect(current().lastPaidCycleKey).toBe('2026-11');
    __resetCommitsForTests();
    usePaymentsStore.getState().setPayments([pay()]);
    expect(current().lastPaidCycleKey).toBeUndefined();
  });

  it('aynı ödemede sıradaki işlem öncekini kaybetmez', () => {
    const run = jest.fn();
    scheduleCommit('paid:3', run);
    markPaidUndoable(3, '2026-11');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('bu dönemi atla', () => {
  const skip = () => skipCycleUndoable(3, '2026-11');

  it('sonraki vadeye geçer, "ödendi" görünmez', () => {
    skip();
    const view = paymentView(current(), NOW);
    expect(view?.status).toBe('due');
    expect(view?.thisMonth).toBe(false);
    expect(nextDueDateOf(current(), NOW)).toEqual(new Date(2026, 11, 8));
  });

  it('ödendi işareti atlamayı siler', () => {
    skip();
    markPaidUndoable(3, '2026-11');
    expect(current().lastSkippedCycleKey).toBeNull();
    expect(paymentView(current(), NOW)?.status).toBe('paid');
  });

  it('süre dolunca sunucuya gider; çevrimdışıysa kuyruğa; geri alınırsa hiçbir yere', () => {
    expect(skip()?.()).toBe(true);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockSkip).not.toHaveBeenCalled();
    skip();
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(mockSkip).toHaveBeenCalledWith(3, '2026-11');
    useNetworkStore.setState({ isOnline: false } as never);
    skip();
    jest.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(useOfflineQueue.getState().ops[0]).toMatchObject({ type: 'skip-payment', id: 3, cycleKey: '2026-11' });
  });

  it('taksit ve tek seferlikte sunulmaz', () => {
    expect(canSkipCycle(pay())).toBe(true);
    expect(canSkipCycle(pay({ recurrence: 'Once' }))).toBe(false);
    expect(canSkipCycle(pay({ installmentCount: 6 }))).toBe(false);
  });
});

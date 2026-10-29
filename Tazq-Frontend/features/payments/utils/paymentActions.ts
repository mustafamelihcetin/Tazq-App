import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { PaymentService, type PaymentPayload } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isNetworkError } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

/**
 * ÖDEME EYLEMLERİ — `features/tasks/utils/taskActions.ts` ile AYNI ilke: iyimser
 * yazma, çevrimdışı kuyruğa alma, gerçek sunucu reddinde (ağ hatası değil) geri alma.
 * Görev eylemleriyle hiçbir kod paylaşımı YOK — ayrı tutulmaları bilinçli (bkz.
 * usePaymentsStore başlığı).
 */

function toPayload(p: Pick<Payment, 'title' | 'amount' | 'dueDay' | 'recurrence' | 'nextDueDate' | 'category' | 'currency'>): PaymentPayload {
  return {
    title: p.title,
    amount: p.amount,
    dueDay: p.dueDay,
    recurrence: p.recurrence,
    nextDueDate: p.nextDueDate ?? null,
    category: p.category ?? null,
    currency: p.currency ?? null,
  };
}

export type CreatePaymentResult = 'ok' | 'queued' | 'failed';

export async function createPaymentAction(input: Omit<Payment, 'id' | 'lastPaidCycleKey'>): Promise<CreatePaymentResult> {
  const tempId = -Date.now();
  const optimistic: Payment = { ...input, id: tempId, lastPaidCycleKey: null };
  usePaymentsStore.getState().addPayment(optimistic);

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'create-payment', tempId, payload: toPayload(input) });
    return 'queued';
  }

  try {
    const created = await PaymentService.createPayment(toPayload(input));
    usePaymentsStore.getState().removePayment(tempId);
    usePaymentsStore.getState().addPayment(created);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'create-payment', tempId, payload: toPayload(input) });
      return 'queued';
    }
    // Gerçek ret (ör. 429 kota) → iyimser kaydı kaldır, kullanıcı eklenmemiş bir
    // ödemeyi listesinde görmesin.
    usePaymentsStore.getState().removePayment(tempId);
    return 'failed';
  }
}

export type PaymentOpResult = 'ok' | 'queued' | 'failed' | 'skipped';

export async function updatePaymentAction(id: number, patch: Partial<Payment>): Promise<PaymentOpResult> {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return 'skipped';

  store.updatePayment(id, patch);
  const after = { ...before, ...patch };

  // Henüz sunucuya hiç yazılmamış (tempId) kayıt — kuyruktaki create-payment henüz
  // işlenmemiş demektir. Burada ayrı bir update-payment eklemek sunucuda var olmayan
  // bir id'yi güncellemeye çalışır (404 ile atılır). Yerel güncelleme yeterli: kuyruk
  // işlendiğinde `toPayload` zaten EN GÜNCEL store değerini kullanacak.
  if (id < 0) return 'ok';

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'update-payment', id, payload: toPayload(after) });
    return 'queued';
  }

  try {
    await PaymentService.updatePayment(id, toPayload(after));
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'update-payment', id, payload: toPayload(after) });
      return 'queued';
    }
    usePaymentsStore.getState().updatePayment(id, before);
    return 'failed';
  }
}

export async function deletePaymentAction(id: number): Promise<PaymentOpResult> {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return 'skipped';

  store.removePayment(id);

  if (id < 0) return 'ok'; // hiç sunucuya ulaşmamış tempId — silinecek bir sunucu kaydı yok

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'delete-payment', id });
    return 'queued';
  }

  try {
    await PaymentService.deletePayment(id);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'delete-payment', id });
      return 'queued';
    }
    // Gerçek ret → kaydı geri koy (silinmediği hâlde silinmiş sanılmasın).
    usePaymentsStore.getState().addPayment(before);
    return 'failed';
  }
}

/**
 * "Ödendi" işaretler — tek dokunuş, geri alınabilir (bkz. app/odemeler.tsx Toast'u).
 * `cycleKey`: aylık "YYYY-MM", yıllık "YYYY", tek seferlik "once" — ekran hesaplar.
 */
export async function markPaymentPaidAction(id: number, cycleKey: string): Promise<PaymentOpResult> {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return 'skipped';

  store.updatePayment(id, { lastPaidCycleKey: cycleKey });

  if (id < 0) return 'ok';

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'mark-paid-payment', id, cycleKey });
    return 'queued';
  }

  try {
    await PaymentService.markPaid(id, cycleKey);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'mark-paid-payment', id, cycleKey });
      return 'queued';
    }
    usePaymentsStore.getState().updatePayment(id, { lastPaidCycleKey: before.lastPaidCycleKey });
    return 'failed';
  }
}

/** "Geri al" — `markPaymentPaidAction`'ın tersi. */
export async function unmarkPaymentPaidAction(id: number): Promise<PaymentOpResult> {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return 'skipped';

  store.updatePayment(id, { lastPaidCycleKey: null });

  if (id < 0) return 'ok';

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'unmark-paid-payment', id });
    return 'queued';
  }

  try {
    await PaymentService.unmarkPaid(id);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'unmark-paid-payment', id });
      return 'queued';
    }
    usePaymentsStore.getState().updatePayment(id, { lastPaidCycleKey: before.lastPaidCycleKey });
    return 'failed';
  }
}

/** Uygulama açılışında/çevrimiçi olunca sunucudan taze liste çek. */
export async function refreshPayments(): Promise<void> {
  if (!useNetworkStore.getState().isOnline) return;
  try {
    const fresh = await PaymentService.getPayments();
    if (Array.isArray(fresh)) usePaymentsStore.getState().setPayments(fresh);
  } catch (e) { swallow('paymentActions.refreshPayments', e); }
}

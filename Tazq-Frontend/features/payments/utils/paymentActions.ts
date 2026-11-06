import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { PaymentService, type PaymentPayload } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isNetworkError } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import { cancelCommit, scheduleCommit } from '@/shared/utils/deferredCommit';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

/**
 * ÖDEME EYLEMLERİ — `features/tasks/utils/taskActions.ts` ile AYNI ilke: iyimser
 * yazma, çevrimdışı kuyruğa alma, gerçek sunucu reddinde (ağ hatası değil) geri alma.
 * Görev eylemleriyle hiçbir kod paylaşımı YOK — ayrı tutulmaları bilinçli (bkz.
 * usePaymentsStore başlığı).
 */

function toPayload(p: Pick<Payment, 'title' | 'amount' | 'dueDay' | 'recurrence' | 'nextDueDate' | 'category' | 'currency' | 'isVariable' | 'installmentCount' | 'installmentStart' | 'icon' | 'color' | 'reminderDays'>): PaymentPayload {
  return {
    title: p.title,
    amount: p.amount,
    dueDay: p.dueDay,
    recurrence: p.recurrence,
    nextDueDate: p.nextDueDate ?? null,
    category: p.category ?? null,
    currency: p.currency ?? null,
    isVariable: !!p.isVariable,
    installmentCount: p.installmentCount ?? null,
    installmentStart: p.installmentStart ?? null,
    icon: p.icon ?? null,
    color: p.color ?? null,
    reminderDays: p.reminderDays ?? null,
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
    // Birimi bilmeyen sunucu (eski sürüm) yanıtı birimsiz döner; seçilen birim kaybolmasın.
    usePaymentsStore.getState().addPayment(created?.currency ? created : { ...created, currency: input.currency ?? null });
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
  return sendDelete(id, before);
}

/**
 * GERİ ALINABİLİR SİLME (2026-11-06). Ödeme hemen gizlenir, sunucudan süre dolunca silinir. Uygulama bu arada kapanırsa ödeme
 * sunucuda durur ve bir sonraki eşitlemede geri gelir: veri kaybı yönünde hata yapılmaz. Dönen işlev süre geçtiyse false döner.
 */
export function deletePaymentUndoable(id: number): (() => boolean) | null {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return null;
  store.removePayment(id);
  const key = `payment:${id}`;
  scheduleCommit(key, () => sendDelete(id, before));
  return () => {
    if (!cancelCommit(key)) return false;
    usePaymentsStore.getState().addPayment(before);
    return true;
  };
}

async function sendDelete(id: number, before: Payment): Promise<PaymentOpResult> {
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
export async function markPaymentPaidAction(id: number, cycleKey: string, amount?: number): Promise<PaymentOpResult> {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return 'skipped';

  // Değişken tutar: ödenen tutar bir sonraki ayın tahmini olur (sunucu da aynısını yapar).
  store.updatePayment(id, paidPatch(before, cycleKey, amount));
  return sendMarkPaid(id, cycleKey, amount, before);
}

const paidPatch = (before: Payment, cycleKey: string, amount?: number): Partial<Payment> => ({
  lastPaidCycleKey: cycleKey,
  lastSkippedCycleKey: null,
  ...(before.isVariable && amount != null ? { amount } : null),
});

const restoreCycle = (id: number, before: Payment) => usePaymentsStore.getState().updatePayment(id, {
  lastPaidCycleKey: before.lastPaidCycleKey,
  lastSkippedCycleKey: before.lastSkippedCycleKey,
  amount: before.amount,
});

/** Dönem işaretini yerelde hemen yapar, sunucuya süre dolunca gönderir. Geri alınca önceki dönem ve tutar aynen döner. */
function undoableCycle(id: number, patch: (before: Payment) => Partial<Payment>, send: (before: Payment) => Promise<unknown>): (() => boolean) | null {
  const store = usePaymentsStore.getState();
  const before = store.payments.find(p => p.id === id);
  if (!before) return null;
  store.updatePayment(id, patch(before));
  const key = `paid:${id}`;
  scheduleCommit(key, () => send(before));
  return () => {
    if (!cancelCommit(key)) return false;
    restoreCycle(id, before);
    return true;
  };
}

/** Geri alınabilir "ödendi". `onSent`: sunucu yanıt verince (geçmiş tazelensin diye). */
export function markPaidUndoable(id: number, cycleKey: string, amount?: number, onSent?: () => void): (() => boolean) | null {
  return undoableCycle(
    id,
    before => paidPatch(before, cycleKey, amount),
    before => sendMarkPaid(id, cycleKey, amount, before).finally(() => onSent?.()),
  );
}

/** Taksit ve tek seferlik ödemede dönem atlanmaz: taksit sayacı kayar, tek seferlik zaten silinir. */
export const canSkipCycle = (p: Payment): boolean => p.recurrence !== 'Once' && !p.installmentCount;

/** Geri alınabilir "bu dönemi atla": geçmişe yazılmaz, tutar tahmini değişmez. */
export function skipCycleUndoable(id: number, cycleKey: string): (() => boolean) | null {
  return undoableCycle(
    id,
    () => ({ lastPaidCycleKey: cycleKey, lastSkippedCycleKey: cycleKey }),
    before => sendSkip(id, cycleKey, before),
  );
}

async function sendSkip(id: number, cycleKey: string, before: Payment): Promise<PaymentOpResult> {
  if (id < 0) return 'ok';

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'skip-payment', id, cycleKey });
    return 'queued';
  }

  try {
    await PaymentService.skipCycle(id, cycleKey);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'skip-payment', id, cycleKey });
      return 'queued';
    }
    restoreCycle(id, before);
    return 'failed';
  }
}

async function sendMarkPaid(id: number, cycleKey: string, amount: number | undefined, before: Payment): Promise<PaymentOpResult> {
  if (id < 0) return 'ok';

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'mark-paid-payment', id, cycleKey, amount });
    return 'queued';
  }

  try {
    await PaymentService.markPaid(id, cycleKey, amount);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'mark-paid-payment', id, cycleKey, amount });
      return 'queued';
    }
    restoreCycle(id, before);
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
    if (!Array.isArray(fresh)) return;
    const { merged, heal } = keepLocalCurrency(fresh, usePaymentsStore.getState().payments);
    usePaymentsStore.getState().setPayments(merged);
    for (const p of heal) PaymentService.updatePayment(p.id, toPayload(p)).catch((e: unknown) => swallow('paymentActions.healCurrency', e));
  } catch (e) { swallow('paymentActions.refreshPayments', e); }
}

/**
 * BİRİM ONARIMI (2026-10-30, kullanıcı: "dolar seçtim, TL oldu"). Birim alanı sunucuya
 * yeni eklendi; eski sunucu onu yok sayıp birimsiz döndürüyordu ve yenileme yerel "USD"yi
 * siliyordu. Sunucu birim bilmiyorsa yerel birim korunur ve sunucuya GERİ yazılır — böylece
 * sunucu güncellendiğinde o ödeme kalıcı olarak ana birime düşmez.
 */
export function keepLocalCurrency(fresh: Payment[], local: Payment[]): { merged: Payment[]; heal: Payment[] } {
  const mine = new Map(local.map(p => [p.id, p]));
  const heal: Payment[] = [];
  const merged = fresh.map(p => {
    const cur = mine.get(p.id)?.currency;
    if (p.currency || !cur) return p;
    const fixed = { ...p, currency: cur };
    heal.push(fixed);
    return fixed;
  });
  return { merged, heal };
}

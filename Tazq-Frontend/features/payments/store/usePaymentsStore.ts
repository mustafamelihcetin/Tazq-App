import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurrencyCode } from '@/shared/utils/currency';
import { isCommitPending } from '@/shared/utils/deferredCommit';

export type PaymentRecurrence = 'Once' | 'Monthly' | 'Quarterly' | 'SemiAnnual' | 'Yearly';

/**
 * Ödeme takibi — GÖREVLERDEN TAMAMEN AYRI bir yüzey (bkz. plan Bölüm 2).
 *
 * Bu store hiçbir zaman `useTaskStore`'a dokunmaz, `TaskService`'i çağırmaz, NLP
 * ayrıştırıcıdan veya günlük plan motorundan geçmez. Eski `features/wallet` (ölü kod)
 * abonelikleri gerçek görev olarak materyalize ediyordu — bu özelliğin terk edilme
 * sebebiydi. Kasıtlı olarak tekrarlanmıyor.
 *
 * Ham durum burada; senkron/iyimser-yazma mantığı `utils/paymentActions.ts`'te
 * (bkz. `features/tasks/utils/taskActions.ts` ile aynı ayrım — ham depo vs. eylemler).
 */
export interface Payment {
  /** Negatif id = henüz sunucuya yazılmamış (tempId, bkz. paymentActions). */
  id: number;
  title: string;
  amount: number;
  /** Ayın hangi günü (1-31). */
  dueDay: number;
  recurrence: PaymentRecurrence;
  /** Tek seferlik ödemenin kesin tarihi (ISO). Recurrence='Once'ta kullanılır. */
  nextDueDate?: string | null;
  /** "Bu dönem ödendi mi" — aylık "YYYY-MM", yıllık "YYYY", tek seferlik "once". */
  lastPaidCycleKey?: string | null;
  /** Bu dönem ödenmedi, atlandı: vade ilerler ama "ödendi" sayılmaz. */
  lastSkippedCycleKey?: string | null;
  category?: string | null;
  /** ISO 4217; boş = ana birim (bkz. features/payments/utils/money). */
  currency?: string | null;
  /** Tutar her ay değişir (elektrik, kart ekstresi): `amount` bir TAHMİN; "ödendi"de gerçek tutar sorulur. */
  isVariable?: boolean;
  /** Taksit sayısı (2–120); boş = süresiz. */
  installmentCount?: number | null;
  /** İlk taksitin dönemi ("YYYY-MM"; yıllıkta "YYYY"). */
  installmentStart?: string | null;
  /** Görünüm (bkz. paymentLook): ikon anahtarı ve renk; boşsa başlıktan tahmin edilir. */
  icon?: string | null;
  color?: string | null;
  /** Vadeden kaç gün önce hatırlatılır (0 = aynı gün, -1 = kapalı). Boş = 3. */
  reminderDays?: number | null;
}

interface PaymentsState {
  payments: Payment[];
  isLoading: boolean;
  /** Seçilmemişse null — ekranlar dil bazlı varsayımı (`defaultCurrencyFor`) kullanır. */
  currency: CurrencyCode | null;
  /** Ödeme kimliği → hatırlatması kurulan son vade. Geç hatırlatma bir kez çalsın diye (bkz. paymentReminders). */
  reminderLedger: Record<string, string>;
  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: number, patch: Partial<Payment>) => void;
  removePayment: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setCurrency: (currency: CurrencyCode) => void;
  /** Geçmiş grafiği açık mı — varsayılan kapalı, cihaza özgü (bkz. PaymentsHistoryCard). */
  chartOpen: boolean;
  setChartOpen: (open: boolean) => void;
}

export const usePaymentsStore = create<PaymentsState>()(
  persist(
    (set, get) => ({
      payments: [],
      isLoading: false,
      currency: null,
      reminderLedger: {},
      chartOpen: false,
      setChartOpen: (chartOpen) => set({ chartOpen }),
      // Geri alma süresindeki işlem sunucuya henüz gitmedi: tazeleme onu ezmesin.
      setPayments: (payments) => {
        const local = new Map(get().payments.map(p => [p.id, p]));
        set({
          payments: payments
            .filter(p => !isCommitPending(`payment:${p.id}`))
            .map(p => (isCommitPending(`paid:${p.id}`) ? local.get(p.id) ?? p : p)),
        });
      },
      addPayment: (payment) => set({ payments: [...get().payments, payment] }),
      updatePayment: (id, patch) =>
        set({ payments: get().payments.map(p => (p.id === id ? { ...p, ...patch } : p)) }),
      removePayment: (id) => set({ payments: get().payments.filter(p => p.id !== id) }),
      setLoading: (loading) => set({ isLoading: loading }),
      setCurrency: (currency) => {
        set({ currency });
        // Tercih snapshot'ıyla buluta (bkz. currencyCloud). Başarısızsa bir sonraki
        // girişte hydrate "bulut ≠ yerel" görüp yeniden gönderir.
        require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().syncToCloud();
      },
    }),
    {
      name: 'tazq-payments',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

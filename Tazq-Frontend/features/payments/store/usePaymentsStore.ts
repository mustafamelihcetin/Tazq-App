import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurrencyCode } from '@/shared/utils/currency';

export type PaymentRecurrence = 'Once' | 'Monthly' | 'Yearly';

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
  category?: string | null;
}

interface PaymentsState {
  payments: Payment[];
  isLoading: boolean;
  /** Seçilmemişse null — ekranlar dil bazlı varsayımı (`defaultCurrencyFor`) kullanır. */
  currency: CurrencyCode | null;
  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: number, patch: Partial<Payment>) => void;
  removePayment: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setCurrency: (currency: CurrencyCode) => void;
}

export const usePaymentsStore = create<PaymentsState>()(
  persist(
    (set, get) => ({
      payments: [],
      isLoading: false,
      currency: null,
      setPayments: (payments) => set({ payments }),
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

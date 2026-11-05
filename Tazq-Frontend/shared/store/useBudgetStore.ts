import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * useBudgetStore — Tasarruf/Bütçe modunun domain verisi.
 * Kilo (useSporStore) mekaniğinin finansal ikizi: başlangıç→hedef tutar +
 * periyodik "bakiye" girişi (haftalık log). İlerleme ve tahmini tarih bundan üretilir.
 */
export type BudgetType = '' | 'birikim' | 'borc' | 'acilfon';

export interface BudgetEntry {
  date: string;   // 'YYYY-MM-DD' (yerel)
  amount: number; // o tarihteki güncel birikim / kalan borç
}

export interface BudgetMove { at: number; delta: number }

interface BudgetState {
  budgetType: BudgetType;
  startAmount: string;   // başlangıç (birikim: 0, borç: borç tutarı)
  targetAmount: string;  // hedef (birikim/acil fon: hedef tutar, borç: 0)
  log: BudgetEntry[];
  /** Acil fon: aylık gider ve hedef güvence ayı. Takip "kaç aylık güvence" diyebilsin diye saklanır. */
  monthlyExpense: number;
  coverMonths: number;
  setCover: (monthly: number, months: number) => void;
  setBudgetType: (v: BudgetType) => void;
  setStartAmount: (v: string) => void;
  setTargetAmount: (v: string) => void;
  addEntry: (amount: number) => void;
  /** Son hareketler (en yeni başta): ekleme/çıkarma geçmişi ve geri alma. */
  moves: BudgetMove[];
  /** Bakiyeye ekler ya da çıkarır (2026-11-05: haftalık kilit kalktı, para her an hareket eder). 0'ın altına inmez. */
  adjust: (delta: number) => number;
  undoMove: (at: number) => void;
  removeEntry: (date: string) => void;
  reset: () => void;
}

export function budgetLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      moves: [],
      adjust: (delta) => {
        const s = get();
        const cur = s.log.length ? s.log.reduce((a, b) => (a.date > b.date ? a : b)).amount : (parseFloat(s.startAmount) || 0);
        const next = Math.max(0, cur + delta);
        const applied = next - cur;
        s.addEntry(next);
        const at = Date.now();
        set(st => ({ moves: [{ at, delta: applied }, ...(st.moves ?? [])].slice(0, 50) }));
        return at;
      },
      undoMove: (at) => {
        const m = (get().moves ?? []).find(x => x.at === at);
        if (!m) return;
        const s = get();
        const cur = s.log.length ? s.log.reduce((a, b) => (a.date > b.date ? a : b)).amount : (parseFloat(s.startAmount) || 0);
        s.addEntry(Math.max(0, cur - m.delta));
        set(st => ({ moves: (st.moves ?? []).filter(x => x.at !== at) }));
      },
      monthlyExpense: 0,
      coverMonths: 0,
      setCover: (monthly, months) => set({ monthlyExpense: monthly, coverMonths: months }),
      budgetType: '',
      startAmount: '',
      targetAmount: '',
      log: [],
      setBudgetType: (v) => set({ budgetType: v }),
      setStartAmount: (v) => set({ startAmount: v }),
      setTargetAmount: (v) => set({ targetAmount: v }),
      addEntry: (amount) => set((s) => {
        const today = budgetLocalDate();
        const filtered = s.log.filter(e => e.date !== today);
        return { log: [...filtered, { date: today, amount }].sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      removeEntry: (date) => set((s) => ({ log: s.log.filter(e => e.date !== date) })),
      // Plan kaldırılınca tüm bütçe verisi sıfırlanır (kilo geçmişi gibi).
      reset: () => set({ budgetType: '', startAmount: '', targetAmount: '', log: [], moves: [], monthlyExpense: 0, coverMonths: 0 }),
    }),
    { name: 'budget-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Son 7 gün içinde girilmiş bakiye kaydı (varsa) — haftalık giriş kilidi için. */
export function getRecentBudgetEntry(log: BudgetEntry[], days = 7): BudgetEntry | null {
  if (!log.length) return null;
  const last = log.reduce((a, b) => (a.date > b.date ? a : b));
  const lastTime = new Date(last.date + 'T00:00:00').getTime();
  return (Date.now() - lastTime) / 86400000 < days ? last : null;
}

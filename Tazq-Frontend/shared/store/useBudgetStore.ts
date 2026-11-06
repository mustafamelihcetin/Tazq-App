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

/** Yedeğe giden özet. Yalnız kullanıcı onayladıysa gönderilir (bkz. DeviceOnlyNote); liste kısa tutulur, sunucuda az yer kaplar. */
export interface BudgetCloud { at: number; budgetType: BudgetType; startAmount: string; targetAmount: string; log: BudgetEntry[]; moves: BudgetMove[]; monthlyExpense: number; coverMonths: number }
const CLOUD_LOG = 104;
const CLOUD_MOVES = 20;

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
  /** Son değişiklik anı: cihazlar arası hangisi yeni. 0: hiç değişmedi. */
  at: number;
  /** Çıkışta cihazı temizler. `reset`ten farkı: "kullanıcı sildi" sayılmaz, girişte yedek geri gelir. */
  clearLocal: () => void;
  cloudSnapshot: () => BudgetCloud | null;
  applyCloud: (c: BudgetCloud | null | undefined) => void;
}

export function budgetLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      moves: [],
      at: 0,
      adjust: (delta) => {
        const s = get();
        const cur = s.log.length ? s.log.reduce((a, b) => (a.date > b.date ? a : b)).amount : (parseFloat(s.startAmount) || 0);
        const next = Math.max(0, cur + delta);
        const applied = next - cur;
        s.addEntry(next);
        const at = Date.now();
        set(st => ({ at, moves: [{ at, delta: applied }, ...(st.moves ?? [])].slice(0, 50) }));
        return at;
      },
      undoMove: (at) => {
        const m = (get().moves ?? []).find(x => x.at === at);
        if (!m) return;
        const s = get();
        const cur = s.log.length ? s.log.reduce((a, b) => (a.date > b.date ? a : b)).amount : (parseFloat(s.startAmount) || 0);
        s.addEntry(Math.max(0, cur - m.delta));
        set(st => ({ at: Date.now(), moves: (st.moves ?? []).filter(x => x.at !== at) }));
      },
      monthlyExpense: 0,
      coverMonths: 0,
      setCover: (monthly, months) => set({ at: Date.now(), monthlyExpense: monthly, coverMonths: months }),
      budgetType: '',
      startAmount: '',
      targetAmount: '',
      log: [],
      setBudgetType: (v) => set({ at: Date.now(), budgetType: v }),
      setStartAmount: (v) => set({ at: Date.now(), startAmount: v }),
      setTargetAmount: (v) => set({ at: Date.now(), targetAmount: v }),
      addEntry: (amount) => set((s) => {
        const today = budgetLocalDate();
        const filtered = s.log.filter(e => e.date !== today);
        return { at: Date.now(), log: [...filtered, { date: today, amount }].sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      removeEntry: (date) => set((s) => ({ at: Date.now(), log: s.log.filter(e => e.date !== date) })),
      // Plan kaldırılınca tüm bütçe verisi sıfırlanır (kilo geçmişi gibi).
      reset: () => set({ at: Date.now(), budgetType: '', startAmount: '', targetAmount: '', log: [], moves: [], monthlyExpense: 0, coverMonths: 0 }),
      clearLocal: () => set({ at: 0, budgetType: '', startAmount: '', targetAmount: '', log: [], moves: [], monthlyExpense: 0, coverMonths: 0 }),
      cloudSnapshot: () => {
        const s = get();
        const empty = !s.budgetType && !s.startAmount && !s.targetAmount && !s.log.length;
        if (empty && !s.at) return null;
        return { at: s.at ?? 0, budgetType: s.budgetType, startAmount: s.startAmount, targetAmount: s.targetAmount, log: s.log.slice(0, CLOUD_LOG), moves: (s.moves ?? []).slice(0, CLOUD_MOVES), monthlyExpense: s.monthlyExpense ?? 0, coverMonths: s.coverMonths ?? 0 };
      },
      // Yalnız yenisi alınır. Boş cihaz (yeni telefon, çıkış sonrası) yedeği her durumda alır; dolu cihazı eski yedek ezemez.
      applyCloud: (c) => {
        if (!c || typeof c !== 'object') return;
        const s = get();
        const untouched = !s.at && !s.budgetType && !s.log.length && !s.startAmount;
        if ((c.at ?? 0) <= (s.at ?? 0) && !untouched) return;
        set({ at: c.at ?? 0, budgetType: c.budgetType ?? '', startAmount: c.startAmount ?? '', targetAmount: c.targetAmount ?? '', log: c.log ?? [], moves: c.moves ?? [], monthlyExpense: c.monthlyExpense ?? 0, coverMonths: c.coverMonths ?? 0 });
      },
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

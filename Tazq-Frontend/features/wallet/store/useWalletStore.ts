import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';

export type ExpenseType = 'gerekli' | 'keyfi';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  type: ExpenseType;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingDay: number; // 1-31
  taskId?: number; // Related TAZQ task ID
}

interface WalletState {
  expenses: Expense[];
  subscriptions: Subscription[];
  
  // Actions
  addExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void;
  removeExpense: (id: string) => void;
  addSubscription: (sub: Omit<Subscription, 'id' | 'taskId'>) => void;
  removeSubscription: (id: string) => void;
  updateSubscriptionTask: (id: string, taskId: number) => void;
  
  // Getters
  getTodayExpenses: () => Expense[];
  getThisMonthExpenses: () => Expense[];
}

const getLocalDateString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      expenses: [],
      subscriptions: [],

      addExpense: (expenseData) => {
        const newExpense: Expense = {
          ...expenseData,
          id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          expenses: [...state.expenses, newExpense],
        }));
      },

      removeExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
      },

      addSubscription: (subData) => {
        const newSub: Subscription = {
          ...subData,
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        };
        set((state) => ({
          subscriptions: [...state.subscriptions, newSub],
        }));
      },

      removeSubscription: (id) => {
        set((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== id),
        }));
      },
      
      updateSubscriptionTask: (id, taskId) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) => 
            s.id === id ? { ...s, taskId } : s
          ),
        }));
      },

      getTodayExpenses: () => {
        const todayStr = getLocalDateString();
        return get().expenses.filter((e) => e.date === todayStr);
      },

      getThisMonthExpenses: () => {
        const today = new Date();
        const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        return get().expenses.filter((e) => e.date.startsWith(prefix));
      },
    }),
    {
      name: 'tazq-wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

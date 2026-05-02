import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  totalFocusHours?: number;
  completedTasksCount?: number;
  activeStreak?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  _hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      _hasHydrated: false,
      setAuth: (user, token) => set({ user, token, isLoggedIn: true }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, isLoggedIn: false }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'tazq-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

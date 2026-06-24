import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_TOKEN_KEY = 'tazq-jwt-token';
const SECURE_REFRESH_KEY = 'tazq-refresh-token';

// Lazy-load expo-secure-store — only available after native rebuild
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch (_) {
  // Native module not compiled yet — token will stay in AsyncStorage until rebuild
}

const secureStorage = {
  getItem: async (name: string) => {
    if (name === 'tazq-auth-storage' && SecureStore) {
      try {
        const token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
        const rest = await AsyncStorage.getItem(name);
        if (!rest) return null;
        const parsed = JSON.parse(rest);
        if (token && parsed?.state) parsed.state.token = token;
        if (refreshToken && parsed?.state) parsed.state.refreshToken = refreshToken;
        return JSON.stringify(parsed);
      } catch {
        return AsyncStorage.getItem(name);
      }
    }
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string) => {
    if (name === 'tazq-auth-storage' && SecureStore) {
      try {
        const parsed = JSON.parse(value);
        const token = parsed?.state?.token;
        const refreshToken = parsed?.state?.refreshToken;
        if (token) {
          await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
          parsed.state.token = null;
        }
        // Refresh token gizli depoda — düz AsyncStorage'a yazılmaz
        if (refreshToken) {
          await SecureStore.setItemAsync(SECURE_REFRESH_KEY, refreshToken);
          parsed.state.refreshToken = null;
        }
        await AsyncStorage.setItem(name, JSON.stringify(parsed));
        return;
      } catch {
        return AsyncStorage.setItem(name, value);
      }
    }
    return AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (name === 'tazq-auth-storage' && SecureStore) {
      try { await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY); } catch {}
      try { await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY); } catch {}
    }
    return AsyncStorage.removeItem(name);
  },
};

interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
  motto?: string;
  avatarBorderColor?: string;
  preferences?: string; // Cihazlar arası eşitlenen tercihler (JSON string)
  totalFocusHours?: number;
  completedTasksCount?: number;
  activeStreak?: number;
}

// Backend'den gelen profil tercihlerini prefs store'a hidrate et.
// Yalnızca DB'de dolu (non-empty) değer varsa uygula — ilk migrasyonda DB null iken
// kullanıcının yerel motto/çerçeve rengini ezme.
function hydrateProfilePrefs(user: User | null) {
  if (!user) return;
  try {
    const prefs = require('./usePrefsStore').usePrefsStore.getState();
    if (typeof user.motto === 'string' && user.motto.trim()) prefs.setMotto(user.motto);
    if (typeof user.avatarBorderColor === 'string' && user.avatarBorderColor.trim()) prefs.setAvatarBorderColor(user.avatarBorderColor);
    // Mod seçimleri, planlar, üretkenlik saati vb. — DB'de doluysa yerele hidrate et.
    if (typeof user.preferences === 'string' && user.preferences.trim()) prefs.hydrateFromCloud(user.preferences);
  } catch {}
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  _hasHydrated: boolean;
  setAuth: (user: User, token: string, refreshToken?: string | null) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoggedIn: false,
      _hasHydrated: false,
      setAuth: (user, token, refreshToken) => {
        hydrateProfilePrefs(user);
        set({ user, token, ...(refreshToken !== undefined ? { refreshToken } : {}), isLoggedIn: true });
      },
      setUser: (user) => { hydrateProfilePrefs(user); set({ user }); },
      logout: () => {
        // Sunucuda refresh token'ı iptal et (best-effort, beklemeden)
        try {
          const rt = useAuthStore.getState().refreshToken;
          if (rt) require('../services/api').AuthService.logout(rt);
        } catch {}
        set({ user: null, token: null, refreshToken: null, isLoggedIn: false });
        // Clear other stores so previous user's data isn't visible after re-login
        try { require('./useTaskStore').useTaskStore.setState({ tasks: [], isLoading: false }); } catch {}
        try { require('./useFocusStore').useFocusStore.getState().reset(); } catch {}
        try { require('./useHabitStore').useHabitStore?.setState({ habits: [] }); } catch {}
      },
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'tazq-auth-storage',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

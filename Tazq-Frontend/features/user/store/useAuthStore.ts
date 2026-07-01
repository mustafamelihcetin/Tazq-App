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

function clearLocalUserData() {
  const safe = (fn: () => void) => { try { fn(); } catch {} };
  safe(() => require('@/features/tasks/store/useTaskStore').useTaskStore.setState({ tasks: [], isLoading: false }));
  safe(() => require('@/features/focus/store/useFocusStore').useFocusStore.getState().reset());
  safe(() => require('@/features/habits/store/useHabitStore').useHabitStore.setState({ habits: [] }));
  safe(() => require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().resetUserData());
  safe(() => require('@/shared/store/useBudgetStore').useBudgetStore.getState().reset());
  safe(() => require('@/shared/store/useQuitStore').useQuitStore.getState().reset());
  safe(() => require('@/shared/store/useSporStore').useSporStore.getState().resetInputs());
  safe(() => require('@/shared/store/useSubjectStore').useSubjectStore.getState().reset());
  safe(() => require('@/shared/store/useOfflineQueue').useOfflineQueue.getState().clear());
  safe(() => require('@/shared/store/useCompletionStore').useCompletionStore.setState({ events: [] }));
  safe(() => require('./useMomentumStore').useMomentumStore.setState({ history: [] }));
  safe(() => require('./useAchievementStore').useAchievementStore.setState({ unlocked: [], pending: null }));
}

// Backend'den gelen profil tercihlerini prefs store'a hidrate et.
// Yalnızca DB'de dolu (non-empty) değer varsa uygula — ilk migrasyonda DB null iken
// kullanıcının yerel motto/çerçeve rengini ezme.
function hydrateProfilePrefs(user: User | null) {
  if (!user) return;
  try {
    const prefs = require('@/features/modes/store/usePrefsStore').usePrefsStore.getState();
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
  lastUserId: number | null; // bu cihazda en son giriş yapan kullanıcı (hesap değişimi tespiti)
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
      lastUserId: null,
      setAuth: (user, token, refreshToken) => {
        // Bu cihazda FARKLI bir hesap giriş yapıyorsa, önceki kullanıcının yerel verisini
        // temizle (logout çalışmamış olsa bile sızıntıyı kapatır).
        const prevId = useAuthStore.getState().lastUserId;
        if (prevId != null && user?.id != null && prevId !== user.id) {
          clearLocalUserData();
        }
        hydrateProfilePrefs(user);
        set({ user, token, ...(refreshToken !== undefined ? { refreshToken } : {}), isLoggedIn: true, lastUserId: user?.id ?? null });
      },
      setUser: (user) => { hydrateProfilePrefs(user); set({ user }); },
      logout: () => {
        // Sunucuda refresh token'ı iptal et (best-effort, beklemeden)
        try {
          const rt = useAuthStore.getState().refreshToken;
          if (rt) require('@/shared/services/api').AuthService.logout(rt);
        } catch {}
        // isLoggedIn=false; lastUserId KORUNUR ki bir sonraki girişte hesap değişimi
        // tespit edilebilsin (aynı kullanıcı geri girerse veri sıfırlanmasın).
        set({ user: null, token: null, refreshToken: null, isLoggedIn: false });
        clearLocalUserData();
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

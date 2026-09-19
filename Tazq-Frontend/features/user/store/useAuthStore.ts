import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';
import { useSessionStore } from '@/shared/store/useSessionStore';

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
      try { await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY); } catch (e) { swallow('authStore.secureTokenDelete', e, { capture: true }); }
      try { await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY); } catch (e) { swallow('authStore.secureRefreshTokenDelete', e, { capture: true }); }
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
  const safe = (fn: () => void) => { try { fn(); } catch (e) { swallow('authStore.clearLocalUserData', e, { capture: true }); } };
  /*
    ── TANITIM SLAYTLARI CİHAZ BAŞINA — BİLİNÇLİ, ÖLÇÜLMÜŞ KARAR ────────────────
    Bayrak çıkışta SİLİNMİYOR. "Hesap başına olmalı mı?" sorusu bir kez daha soruldu ve
    cevap yine hayır; gerekçe kayda geçsin diye burada:

     · Slaytlar ÜRÜN ANLATIMI ("TAZQ nedir"), hesap kurulumu değil. Çıkıştan sonra
       kullanıcıyla giriş ekranı arasına dört slaytlık bir tanıtım koymak, en sık
       yapılan işi bir reklamın arkasına saklamak olurdu.
     · Slaytların yazdığı TEK kullanıcı-özel tercih `uiMode` (Sade mod). Varsayılanı
       `pro` — yani zengin arayüz; sorulmaması kimseyi eksik bir deneyime düşürmüyor,
       üstelik Ayarlar'da tek dokunuşluk bir anahtar.
     · Hesap başına OLMASI gerekenler zaten hesap başına: hoş geldin/profil kurulumu
       (bkz. usePrefsStore → welcomeStatus) ve sayfa turları (completedTours). İkisi de
       çıkışta sıfırlanıyor.

    Yani cihaz bayrağı yalnız "bu kişi TAZQ'yu tanıyor" bilgisini taşıyor ve bu bilgi
    gerçekten cihaza ait.
  */
  safe(() => require('@/features/tasks/store/useTaskStore').useTaskStore.setState({ tasks: [], isLoading: false }));
  safe(() => require('@/features/focus/store/useFocusStore').useFocusStore.getState().reset());
  safe(() => require('@/features/habits/store/useHabitStore').useHabitStore.setState({ habits: [] }));
  safe(() => require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().resetUserData());
  safe(() => require('@/shared/store/useBudgetStore').useBudgetStore.getState().reset());
  safe(() => require('@/shared/store/useQuitStore').useQuitStore.getState().reset());
  // `clearAll` (resetInputs DEĞİL): çıkışta kilo geçmişi de cihazdan silinmeli.
  // Artık buluta eşitlendiği için tekrar girişte geri gelir; `resetInputs` ise plan
  // kaldırma yolunda kullanılıyor ve geçmişe kasten dokunmuyor.
  safe(() => require('@/features/modes/store/useSporStore').useSporStore.getState().clearAll());
  safe(() => require('@/shared/store/useSubjectStore').useSubjectStore.getState().reset());
  safe(() => require('@/shared/store/useOfflineQueue').useOfflineQueue.getState().clear());
  // Odak geçmişi kişisel veridir: çıkışta cihazdan silinir (bkz. useFocusHistoryStore).
  safe(() => require('@/features/report/useFocusHistoryStore').useFocusHistoryStore.getState().clear());
  safe(() => require('@/shared/store/useCompletionStore').useCompletionStore.setState({ events: [] }));
  safe(() => require('./useMomentumStore').useMomentumStore.setState({
    history: [],
    momentumShieldActive: false,
    shieldCharges: 2,
    focusMinutesForNextCharge: 0,
    tasksCompletedForNextCharge: 0,
    engineHeat: 0,
    isOverheated: false,
    lastCompletedTaskTitle: null,
    showRocketFeedback: false,
  }));
  safe(() => require('./useAchievementStore').useAchievementStore.setState({
    unlocked: [],
    baselined: false,
    pending: null,
    queue: [],
  }));
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
  } catch (e) { swallow('authStore.hydrateProfilePrefs', e, { capture: true }); }
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  /**
   * MİSAFİR MODU — hesapsız, tamamen yerel kullanım.
   *
   * ÖLÇÜLEN SORUN: onboarding'in sonunda kullanıcı doğrudan /login'e atılıyordu.
   * Bir yapılacaklar uygulamasını denemek için önce e-posta, şifre ve 13-yaş onayı
   * isteniyordu; oysa uygulamanın çekirdeği (görev, alışkanlık, odak) zaten
   * offline-first ve yerel store'larla çalışıyor — sunucu gerektirmiyordu. Yani
   * kayıt duvarı teknik bir zorunluluk değil, sadece bir varsayımdı.
   *
   * SÖZLEŞME: misafirken hiçbir istek sunucuya GİTMEZ (bkz. api.ts kapısı) ama
   * yapılan her şey offline kuyruğuna yazılır. Kullanıcı sonradan kayıt olunca
   * kuyruk mevcut senkron yolundan aynen akar — yani "denerken yaptıkların
   * kaybolur" durumu YOK.
   */
  _hasHydrated: boolean;
  lastUserId: number | null; // bu cihazda en son giriş yapan kullanıcı (hesap değişimi tespiti)
  isFirstLogin: boolean;
  setAuth: (user: User, token: string, refreshToken?: string | null, isFirstLogin?: boolean) => void;
  /** Hesapsız kullanıma geç. Yerel veriye DOKUNMAZ. */
  startGuest: () => void;
  /** Misafirlikten çık (kayıt/giriş sonrası). Yerel veriye DOKUNMAZ — taşınacak. */
  endGuest: () => void;
  setIsFirstLogin: (val: boolean) => void;
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
      isFirstLogin: false,
      setAuth: (user, token, refreshToken, isFirstLogin) => {
        // Bu cihazda FARKLI bir hesap giriş yapıyorsa, önceki kullanıcının yerel verisini
        // temizle (logout çalışmamış olsa bile sızıntıyı kapatır).
        const prevId = useAuthStore.getState().lastUserId;
        /*
          MİSAFİRDEN GELİNİYORSA TEMİZLİK YOK. Cihazdaki veri önceki hesabın değil,
          misafirin — ve "Hesap oluştur — verilerim kalsın" sözü tam olarak onun yeni
          hesaba taşınması. Eskiden cihazda daha önce BAŞKA bir hesap kullanılmışsa bu
          temizlik misafirin görevlerini, alışkanlıklarını ve gönderim kuyruğunu siliyordu.
          Güvenli: önceki hesabın verisi çıkışta zaten silinir (logout) ve misafirlik ancak
          çıkıştan sonra başlayabilir.
        */
        const fromGuest = useSessionStore.getState().isGuest;
        if (!fromGuest && prevId != null && user?.id != null && prevId !== user.id) {
          clearLocalUserData();
        }
        hydrateProfilePrefs(user);
        useSessionStore.getState().setGuest(false); // gerçek hesap geldi — misafirlik biter
        set({
          user,
          token,
          ...(refreshToken !== undefined ? { refreshToken } : {}),
          isLoggedIn: true,
          lastUserId: user?.id ?? null,
          isFirstLogin: isFirstLogin ?? false
        });
      },
      startGuest: () => useSessionStore.getState().setGuest(true),
      /*
        MİSAFİRLİK BİTERKEN YEREL VERİ SİLİNMEZ.

        Kullanıcı denerken oluşturduğu görevleri kaybetmemeli — kayıt olmak bir
        "sıfırdan başla" eylemi değil, "buraya kadar yaptıklarımı sahiplen" eylemi.
        Kuyruk `useOfflineSync` ile yeni hesaba akar.
      */
      endGuest: () => useSessionStore.getState().setGuest(false),
      setIsFirstLogin: (val) => set({ isFirstLogin: val }),
      setUser: (user) => { hydrateProfilePrefs(user); set({ user }); },
      logout: () => {
        // Sunucuda refresh token'ı iptal et (best-effort, beklemeden)
        try {
          const rt = useAuthStore.getState().refreshToken;
          if (rt) require('@/shared/services/api').AuthService.logout(rt);
        } catch (e) { swallow('authStore.logoutRevokeRefreshToken', e, { capture: true }); }
        // isLoggedIn=false; lastUserId KORUNUR ki bir sonraki girişte hesap değişimi
        // tespit edilebilsin (aynı kullanıcı geri girerse veri sıfırlanmasın).
        useSessionStore.getState().setGuest(false);
        set({ user: null, token: null, refreshToken: null, isLoggedIn: false, isFirstLogin: false });
        clearLocalUserData();
      },
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'tazq-auth-storage',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // isFirstLogin yalnız o oturuma özel: her açılışta sıfırlanır. Böylece yardım turu
        // sadece kayıt sonrası ilk oturumda gösterilir; sonraki açılışlarda/mevcut kullanıcılarda çıkmaz.
        if (state) state.isFirstLogin = false;
      },
    }
  )
);

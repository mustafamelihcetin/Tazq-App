import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';
import { AppState } from 'react-native';
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

/*
  ANAHTARLIK KİLİTLİYKEN OTURUM (2026-11-05). Varsayılan erişim "yalnız kilit açıkken": saat, bildirim ya da arka plan
  uygulamayı kilitli telefonda uyandırınca okuma hata veriyor, oturum "anahtarsız" sanılıp kapatılıyordu; yazma hatası
  ise anahtarları şifresiz depoya düşürüyordu. Artık ilk kilit açılışından sonra erişilebilir; okunamazsa oturum
  KAPATILMAZ, uygulama öne gelince yeniden okunur; yazılamazsa düz metne düşmez, öne gelince yeniden denenir.
*/
let keychainUnavailable = false;
let pendingSecureWrite: { token?: string; refreshToken?: string; keepMissing?: boolean } | null = null;
export const isKeychainUnavailable = () => keychainUnavailable;
const secureOptions = () => (SecureStore ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined);

/*
  ANAHTARLIK YAZIMI TEK SIRADA (2026-11-05, kullanıcı: "dev sürümde sürekli logout"; kayıt: sunucuya iptal edilmiş anahtar sunuldu, 30 dk dolmadan 401 geldi).
  İki kusur vardı. Boş değer atlanıyordu: çıkışta anahtarlar silinmiyor, bir sonraki yüklemede ölü anahtar belleğe geri dönüyordu. Yazımlar da sıraya girmiyordu: eski yazım yenisinin üstüne binebiliyordu.
  Sunucu ölü anahtarı hırsızlık sayıp TÜM oturumları kapatır; yani tek bayat okuma kullanıcıyı dışarı atar.
*/
const BOOTED_AT = Date.now() / 1000;
/** Tanı için JWT'nin yaşı; anahtarın kendisi hiçbir kayda yazılmaz. */
export function jwtAgeMinutes(token: string | null | undefined): string {
  try {
    const part = (token ?? '').split('.')[1];
    if (!part) return 'none';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(globalThis.atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')));
    return claims.iat ? String(Math.round((Date.now() / 1000 - claims.iat) / 60)) : claims.exp ? `exp${Math.round((claims.exp - Date.now() / 1000) / 60)}` : 'unknown';
  } catch { return 'unreadable'; }
}
let secureQueue: Promise<unknown> = Promise.resolve();
export function writeSecure(v: { token?: string; refreshToken?: string; keepMissing?: boolean }): Promise<void> {
  // keepMissing: oturum açıkken boş değer "bilinmiyor" demektir (kilitli telefonda anahtarlık okunamadı), silme emri değil. Silmek oturumu öldürürdü.
  const run = async () => {
    if (!SecureStore) return;
    if (v.token) await SecureStore.setItemAsync(SECURE_TOKEN_KEY, v.token, secureOptions());
    else if (!v.keepMissing) await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    if (v.refreshToken) await SecureStore.setItemAsync(SECURE_REFRESH_KEY, v.refreshToken, secureOptions());
    else if (!v.keepMissing) await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY);
  };
  const next = secureQueue.then(run, run);
  secureQueue = next.catch(() => undefined);
  return next;
}
/** Bekleyen yazımlar bitmeden anahtarlık okunmaz: okuma yenisini görmeli. */
const secureSettled = () => secureQueue;

const secureStorage = {
  getItem: async (name: string) => {
    if (name === 'tazq-auth-storage' && SecureStore) {
      let token: string | null = null;
      let refreshToken: string | null = null;
      try {
        await secureSettled();
        token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        refreshToken = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
        keychainUnavailable = false;
      } catch (e) {
        keychainUnavailable = true;
        swallow('authStore.keychainRead', e);
      }
      const rest = await AsyncStorage.getItem(name);
      if (!rest) return null;
      try {
        const parsed = JSON.parse(rest);
        // Çıkış yapılmış hesapta anahtarlıkta kalmış artık belleğe dönmez.
        if (token && parsed?.state?.isLoggedIn) parsed.state.token = token;
        if (refreshToken && parsed?.state?.isLoggedIn) parsed.state.refreshToken = refreshToken;
        return JSON.stringify(parsed);
      } catch {
        return rest;
      }
    }
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string) => {
    if (name === 'tazq-auth-storage' && SecureStore) {
      const parsed = JSON.parse(value);
      const secrets = { token: parsed?.state?.token ?? undefined, refreshToken: parsed?.state?.refreshToken ?? undefined, keepMissing: !!parsed?.state?.isLoggedIn };
      // Anahtarlar hiçbir koşulda düz AsyncStorage'a yazılmaz.
      if (parsed?.state) { parsed.state.token = null; parsed.state.refreshToken = null; }
      try {
        await writeSecure(secrets);
        pendingSecureWrite = null;
      } catch (e) {
        pendingSecureWrite = secrets;
        swallow('authStore.keychainWrite', e);
      }
      await AsyncStorage.setItem(name, JSON.stringify(parsed));
      return;
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
  // İLK İŞ: alışkanlık gönderim kapısını kapat — aşağıda silinen (boş) liste buluttaki
  // kopyayı EZMESİN (bkz. features/habits/sync/habitsSync.ts).
  safe(() => require('@/features/habits/sync/habitsSync').resetHabitsSync());
  safe(() => useSessionStore.getState().setGuestProfile(null));
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
  safe(() => require('@/features/modes/store/useStagedPlanStore').useStagedPlanStore.getState().reset()); // kademeli açılım sırası
  safe(() => require('@/shared/store/useBudgetStore').useBudgetStore.getState().reset());
  safe(() => require('@/shared/store/useQuitStore').useQuitStore.getState().reset());
  // `clearAll` (resetInputs DEĞİL): çıkışta kilo geçmişi de cihazdan silinmeli.
  // Artık buluta eşitlendiği için tekrar girişte geri gelir; `resetInputs` ise plan
  // kaldırma yolunda kullanılıyor ve geçmişe kasten dokunmuyor.
  safe(() => require('@/features/modes/store/useSporStore').useSporStore.getState().clearAll());
  safe(() => require('@/shared/store/useSubjectStore').useSubjectStore.getState().reset());
  safe(() => require('@/features/studyplan/store/useStudyPlanStore').useStudyPlanStore.getState().reset());
  safe(() => require('@/features/modes/store/usePlanAffinityStore').usePlanAffinityStore.getState().reset());
  safe(() => require('@/features/modes/hooks/useDayRoute').useDayRouteStore.getState().reset());
  safe(() => require('@/features/modes/components/plan/WaterGlass').useWaterStore.getState().reset());
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
    // Bulutta tercih olmasa da (yeni hesap) kapı açılır: yükleme denendi, karşılaştırılacak kopya yok.
    if (user.id != null) prefs.markCloudHydrated(user.id);
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
  /** `forced`: kullanıcı istemedi (oturum reddedildi vb.) → yerel veri SİLİNMEZ, sebep kayda geçer. */
  logout: (opts?: { forced?: boolean; reason?: string }) => void;
  /** Zorla çıkış sonrası yerel veri duruyor: başka hesap/misafir gelirse temizlenmeli. */
  retainedData: boolean;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
        set({ retainedData: false });
        set({
          user,
          token,
          ...(refreshToken !== undefined ? { refreshToken } : {}),
          isLoggedIn: true,
          lastUserId: user?.id ?? null,
          isFirstLogin: isFirstLogin ?? false
        });
      },
      startGuest: () => {
        // Zorla çıkıştan kalan hesap verisi misafire görünmesin.
        if (get().retainedData) { clearLocalUserData(); set({ retainedData: false }); }
        useSessionStore.getState().setGuest(true);
        /*
          HOŞ GELDİN MİSAFİRE DE (2026-10-24). Yalnız bu GİRİŞ ANINDA beklemeye alınır:
          bugün misafir olarak kullanan biri güncellemeden sonra durduk yere hoş geldin
          görmez (onun bayrağı 'unknown' kalır, startGuest bir daha çağrılmaz). Hoş
          geldini daha önce bitirmiş biri ('done') tekrar görmez.
        */
        try {
          const prefs = require('@/features/modes/store/usePrefsStore').usePrefsStore.getState();
          if (prefs.welcomeStatus === 'unknown') prefs.setWelcomeStatus('pending');
        } catch (e) { swallow('authStore.startGuestWelcome', e); }
      },
      /*
        MİSAFİRLİK BİTERKEN YEREL VERİ SİLİNMEZ.

        Kullanıcı denerken oluşturduğu görevleri kaybetmemeli — kayıt olmak bir
        "sıfırdan başla" eylemi değil, "buraya kadar yaptıklarımı sahiplen" eylemi.
        Kuyruk `useOfflineSync` ile yeni hesaba akar.
      */
      endGuest: () => useSessionStore.getState().setGuest(false),
      setIsFirstLogin: (val) => set({ isFirstLogin: val }),
      setUser: (user) => { hydrateProfilePrefs(user); set({ user }); },
      logout: (opts) => {
        /*
          ZORLA ÇIKIŞ VERİ SİLMEZ (2026-11-05). Kullanıcının istemediği çıkış görevleri, alışkanlıkları ve BEKLEYEN
          çevrimdışı kuyruğu da siliyordu. Aynı hesap dönünce kaldığı yerden devam eder; başka hesap gelince setAuth
          temizler. Sebep kayda geçer ki bir sonraki "kendiliğinden çıkış" tahminle değil kanıtla çözülsün.
        */
        if (opts?.forced) {
          // Eşzamanlı 401'lerin hepsi buraya düşer: yalnız ilki sayılır (bir olay, bir kayıt).
          if (!get().isLoggedIn) return;
          const reason = opts.reason ?? 'unknown';
          try {
            require('@/features/habits/sync/habitsSync').resetHabitsSync();
            require('@/shared/services/api').SupportService.reportCrash({
              errorMessage: `Forced logout: ${reason}`, stackTrace: `appState=${AppState.currentState} keychain=${keychainUnavailable ? 'unavailable' : 'ok'} jwtAgeMin=${jwtAgeMinutes(get().token)} uptimeSec=${Math.round(Date.now() / 1000 - BOOTED_AT)} user=${get().user?.id ?? '-'}`,
              deviceName: `auth ${__DEV__ ? 'dev' : 'release'} ${require('expo-constants').default.deviceName ?? ''}`.slice(0, 60), platform: require('react-native').Platform.OS, appVersion: require('expo-constants').default.expoConfig?.version ?? '',
            }).catch((e: unknown) => swallow('authStore.reportForcedLogout', e));
          } catch (e) { swallow('authStore.forcedLogout', e); }
          useSessionStore.getState().setGuest(false);
          set({ user: null, token: null, refreshToken: null, isLoggedIn: false, isFirstLogin: false, retainedData: true });
          return;
        }
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
      retainedData: false,
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

// Öne gelince: kilitliyken okunamayan anahtarları yeniden oku, yazılamayanları yeniden yaz.
AppState.addEventListener?.('change', (st) => {
  if (st !== 'active') return;
  if (pendingSecureWrite) {
    const v = pendingSecureWrite;
    writeSecure(v).then(() => { pendingSecureWrite = null; }).catch((e) => swallow('authStore.keychainRetry', e));
  }
  if (keychainUnavailable) secureSettled().then(() => useAuthStore.persist.rehydrate());
});

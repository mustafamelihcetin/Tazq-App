import 'react-native-gesture-handler';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

try {
  const { NativeModules } = require('react-native');
  if (NativeModules.RNGoogleSignin) {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '995645524095-m5hinfq75f1fa1kfi3oio2rcgm4cl05n.apps.googleusercontent.com',
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '995645524095-cd867f78b9768j1j8amr5oipee2cnr55.apps.googleusercontent.com',
      offlineAccess: true,
    });
  } else {
    // GELİŞTİRİCİ UYARISI — kullanıcı hatası değil, kurulum eksikliği.
    // `__DEV__` kapısı: release'de konsolu kimse okumaz, çıktı boşa gider; ayrıca bu
    // durum Expo Go'da NORMALDİR (native modül yok) ve her açılışta uyarı basmak
    // gerçek uyarıları gözden düşürür.
    if (__DEV__) console.warn('[Google Sign-In] Native module "RNGoogleSignin" not found. Google Sign-In is disabled.');
  }
} catch (e) {
  swallow('layout.googleSignInInit', e);
}

// Initialize crash reporting as early as possible — before any other imports
import { initSentry, setSentryUser } from '@/shared/utils/sentry';
initSentry();

import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View, LogBox, AppState, Text, TextInput, Animated, StyleSheet } from 'react-native';
import { uiDepth } from '@/shared/constants/uiDepth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- GLOBAL TYPOGRAPHY PROTECTION ---
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.maxFontSizeMultiplier = 1.15;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.15;
// ------------------------------------
import { Colors } from '@/shared/constants/Colors';
import { useAuthStore } from '@/features/user';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { AuthService, FocusService, api } from '@/shared/services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TourProvider } from '@/shared/components/TourContext';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { syncTasksAndHabitsLanguage } from '@/features/tasks/utils/systemTaskTranslator';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useTaskStore, initIntelligence } from '@/features/tasks';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import {
  scheduleMorningBrief,
  scheduleEveningBrief,
  cancelMorningBrief,
  cancelEveningBrief,
  scheduleShutdownNotification,
  cancelHabitAtRisk,
  requestNotificationPermissions,
  getNotificationPermissionStatus,
  showFocusNotification,
  cancelFocusNotification,
  registerNotificationCategories,
} from '@/shared/utils/notifications';
import { useFocusStore, FocusIsland } from '@/features/focus';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplash } from '@/shared/components/AnimatedSplash';
import { Toast } from '@/shared/components/Toast';
import { CelebrationOverlay } from '@/features/user/components/CelebrationOverlay';
import { OfflineBanner } from '@/shared/components/OfflineBanner';
import { ConfettiOverlay } from '@/shared/components/ConfettiOverlay';
import { CustomAlertModal } from '@/shared/components/CustomAlert';
import { NotificationPrimer } from '@/shared/components/NotificationPrimer';
import { RocketFeedback } from '@/features/user/components/RocketFeedback';
import { Asset } from 'expo-asset';
import { useOfflineSync } from '@/shared/hooks/useOfflineSync';
import { usePrefsSync } from '@/shared/hooks/usePrefsSync';
import { usePlanAdaptations } from '@/features/modes';

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

// Defensive native module loader to prevent Expo Go crashes
const isExpoGo = Constants.appOwnership === 'expo';

const safeSystemUI = async (color: string) => {
  if (Platform.OS === 'web' || isExpoGo) return;
  try {
    const SystemUI = require('expo-system-ui');
    if (SystemUI && SystemUI.setBackgroundColorAsync) {
      await SystemUI.setBackgroundColorAsync(color);
    }
  } catch (e) {
    // Silently ignore
  }
};

const safeNavigationBar = async (style: 'light' | 'dark', bgColor: string) => {
  if (Platform.OS !== 'android' || isExpoGo) return;
  try {
    const NavigationBar = require('expo-navigation-bar');
    if (NavigationBar && NavigationBar.setBackgroundColorAsync) {
      // Samsung devices ignore button style if background is transparent/absolute.
      // Explicitly setting a solid background color forces the correct button style.
      await NavigationBar.setBackgroundColorAsync(bgColor);
      await NavigationBar.setButtonStyleAsync(style);
    }
  } catch (e) {
    // Silently ignore
  }
};

// Susturulacak kütüphane uyarıları
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
  '`setBackgroundColorAsync` is not supported',
  '`setBehaviorAsync` is not supported',
  '`setButtonStyleAsync` is not supported',
]);

import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  PlusJakartaSans_800ExtraBold_Italic
} from '@expo-google-fonts/plus-jakarta-sans';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { usePrefsStore } from '@/features/modes';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { swallow } from '@/shared/utils/swallow';
import { httpStatusOf } from '@/shared/utils/errors';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-Medium': PlusJakartaSans_500Medium,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
    'Jakarta-BoldItalic': PlusJakartaSans_800ExtraBold_Italic,
  });

  const { theme, colorScheme, isDark } = useAppTheme();
  /*
    İŞLETİM SİSTEMİNİN görünümü — uygulamanın tema TERCİHİNDEN ayrı.
    Açılış ekranı bunu izliyor: sistem splash'i de OS görünümüne göre açık/koyu
    çiziliyor ve ikisi ayrışırsa devir teslim anında renk sıçraması görünür
    (bkz. AnimatedSplash).
  */
  const systemScheme = useColorScheme();
  const { isLoggedIn, token, setUser, logout, _hasHydrated } = useAuthStore();
  const isGuest = useSessionStore(s => s.isGuest);
  const currentUser = useAuthStore((s) => s.user);

  // Sentry kullanıcı bağlamı: giriş/çıkış ve açılışta oturum geri yüklemesinin hepsi `user`'a
  // yansıdığından, tek effect tüm durumları kapsar. Yalnız id + role (PII yok) → hatalar kime ait belli olur.
  useEffect(() => {
    setSentryUser(currentUser ? { id: currentUser.id, role: (currentUser as any).role } : null);
  }, [currentUser?.id]);
  const segments = useSegments();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Replay queued offline operations when connection is restored
  useOfflineSync();
  usePrefsSync();
  usePlanAdaptations();
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const { sync, language } = useLanguageStore();
  const { tasks } = useTaskStore();
  const { morningBrief: morningBriefEnabled, eveningBrief: eveningBriefEnabled, productivityHour, notifPrimerSeen, _hasHydrated: prefsHydrated } = usePrefsStore();
  const focusActive = useFocusStore((s) => s.isActive);

  // Preload all critical assets
  useEffect(() => {
    async function prepare() {
      try {
        // Preload logo images to prevent flashing
        await Asset.loadAsync([
          require('../assets/brand/icon.png'),
          require('../assets/images/tazq_text_white.png'),
          require('../assets/images/tazq_text_dark.png'),
        ]);
        setAssetsLoaded(true);
      } catch (e) {
        swallow('layout.assetPreload', e);
        setAssetsLoaded(true); // Proceed anyway
      }
    }
    prepare();
  }, []);

  // Sync language and intelligence when fonts are ready
  useEffect(() => {
    if (fontsLoaded && assetsLoaded) {
      sync();
      initIntelligence();
      // We don't hide the splash here anymore, we wait for AnimatedSplash to mount
    }
  }, [fontsLoaded, assetsLoaded]);

  useEffect(() => {
    syncTasksAndHabitsLanguage(language);
  }, [language]);

  // Global focus timer — keeps ticking across all screens without re-rendering layout
  useEffect(() => {
    if (!focusActive) {
      cancelFocusNotification();
      return;
    }

    const interval = setInterval(() => {
      const { seconds, tick, isActive } = useFocusStore.getState();
      if (!isActive || seconds <= 0) return;
      tick();
    }, 1000);

    // Clean up any lingering focus notifications
    cancelFocusNotification();

    return () => {
      clearInterval(interval);
      cancelFocusNotification();
    };
  }, [focusActive]);

  /*
    BİLDİRİM İZNİ ARTIK BURADA İSTENMİYOR — yalnız MEVCUT izin okunuyor.

    ÖLÇÜLEN SORUN: bu effect girişten hemen sonra `requestNotificationPermissions()`
    çağırıyordu, yani sistem diyaloğunu açıyordu. Kullanıcı henüz tek görev bile
    eklememişken "TAZQ size bildirim göndermek istiyor" penceresini görüyordu ve ne
    göndereceğimiz yazmıyordu. iOS'ta o pencere kullanıcı başına BİR KEZ açılabilir:
    reddedilirse sabah özeti, akşam özeti, görev ve alışkanlık hatırlatıcıları KALICI
    olarak kapanıyordu.

    Şimdi: izin zaten varsa her şey eskisi gibi kurulur. İzin yoksa burada hiçbir şey
    sorulmaz — önce kendi ön-bilgilendirme ekranımız çıkar (NotificationPrimer) ve
    sistem diyaloğu ancak kullanıcı "aç" derse açılır.
  */
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    if (!isLoggedIn) return;
    getNotificationPermissionStatus().then(setNotifPermission);
  }, [isLoggedIn]);

  /*
    ÖN-BİLGİLENDİRME NE ZAMAN ÇIKAR: kullanıcının hatırlatılacak bir şeyi olduğunda.

    Girişte sormak, henüz hiçbir görevi olmayan birine "hatırlatayım mı" demektir —
    cevabı doğal olarak "hayır"dır ve iOS'ta o "hayır" kalıcıdır. En az bir görev
    varken sorulduğunda soru anlamlı hâle gelir.

    'denied' durumunda GÖSTERİLMEZ: sistem bir daha sormamıza izin vermiyor, bizim
    ekranımız da kullanıcıyı Ayarlar'a yollamaktan başka bir şey yapamaz — istenmemiş
    bir engel olur. Kullanıcı isterse Ayarlar → BİLDİRİMLER'den açabilir.
  */
  const showNotifPrimer =
    isLoggedIn &&
    prefsHydrated &&
    !notifPrimerSeen &&
    notifPermission === 'undetermined' &&
    tasks.length > 0;

  useEffect(() => {
    if (!isLoggedIn) return;
    if (notifPermission !== 'granted') return;
    {
      registerNotificationCategories();

      const allTasks = tasks;
      const today = new Date().toDateString();
      /*
        ── ÖZETLER ANA EKRANLA AYNI GÜNÜ SAYAR ───────────────────────────────
        İki sayım da ana ekrandan AYRIŞMIŞTI:

         · "Bugün N görevin var" yalnız vadesi TAM BUGÜN olanları sayıyordu.
           Beş gecikmiş görevi olan ama bugüne bir şey yazmamış kullanıcı sabah
           "0 görevin var" bildirimi alıyordu — hem yanlış hem de tam tersi etki
           yapan bir cümle. Ana ekran gecikmişleri bugünün işine dahil ediyor
           (bkz. app/index.tsx → dayScope); özet de öyle.

         · "Bugün tamamladıkların" yalnız `completedAt` taşıyan kayıtları
           sayıyordu. Sunucu bu alanı tutmuyor (bkz. useTaskStore.setTasks), yani
           o kayıtlar hiç sayılmıyordu. Yedek olarak vadeye düşülüyor — ekranın
           her yerinde kullanılan aynı kural.
      */
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const todayTasks = allTasks.filter(t => {
        if (t.isCompleted || !t.dueDate) return false;
        const ms = new Date(t.dueDate).getTime();
        return !Number.isNaN(ms) && ms <= todayEnd.getTime();
      });
      const pending = allTasks.filter(t => !t.isCompleted).length;
      const completedToday = allTasks.filter(t => {
        if (!t.isCompleted) return false;
        const when = t.completedAt ?? t.dueDate;
        return !!when && new Date(when).toDateString() === today;
      }).length;

      // Habit streak from cockpit store — best-effort
      let streak = 0;
      try {
        const { habits } = require('@/features/habits').useHabitStore.getState();
        streak = habits?.reduce((max: number, h: any) => Math.max(max, h.streak ?? 0), 0) ?? 0;
      } catch (e) { swallow('layout.readHabitStreakForBrief', e); }

      // Morning brief: today's task count + streak (respects user preference)
      if (morningBriefEnabled) {
        scheduleMorningBrief(todayTasks.length, streak, language || 'en', productivityHour, currentUser?.name);
      } else {
        cancelMorningBrief();
      }

      // Evening brief: completed today vs still pending (respects user preference)
      if (eveningBriefEnabled) {
        scheduleEveningBrief(completedToday, pending, language || 'en', currentUser?.name);
      } else {
        cancelEveningBrief();
      }
    }
  /*
    ── TERCİH DEĞİŞİNCE YENİDEN ZAMANLA ────────────────────────────────────────
    Bağımlılıklar yalnız [isLoggedIn, notifPermission] idi. Ayarlar'da anahtarı KAPATMAK
    çalışıyordu (o ekran doğrudan cancel çağırıyor) ama AÇMAK hiçbir şey yapmıyordu: bu
    effect yeniden çalışmadığı için bildirim bir daha zamanlanmıyor, sonraki soğuk
    açılışa kadar sessizce ölü kalıyordu. Yani kullanıcı anahtarı açıyor, yeşil görüyor,
    bildirim gelmiyordu.

    Listeye kullanıcının BİLEREK değiştirebildiği şeyler eklendi (tercihler, dil, saat).
    `tasks` bilerek DIŞARIDA: her görev değişiminde bildirimleri iptal edip yeniden
    kurmak gürültü olurdu; sayılar bir sonraki açılışta zaten tazeleniyor.
  */
  }, [isLoggedIn, notifPermission, morningBriefEnabled, eveningBriefEnabled, language, productivityHour]);


  // Notification response handler — covers tap, Watch action buttons, and Lock Screen actions
  useEffect(() => {
    let sub: any;
    try {
      const Notifs = require('expo-notifications');
      sub = Notifs.addNotificationResponseReceivedListener((response: any) => {
        const action = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data ?? {};

        // Watch/Lock Screen: "✅ Tamamla" on task reminder (mark complete silently)
        if (action === 'task-complete' && data.taskId) {
          try {
            const { api: taskApi } = require('@/shared/services/api');
            taskApi.patch(`/tasks/${data.taskId}`, { isCompleted: true }).catch((e: unknown) => swallow('layout.notifCompleteTaskPatch', e, { capture: true }));
            /*
              YEREL LİSTE DOĞRUDAN GÜNCELLENİYOR.

              Burada `useTaskStore.getState().fetchTasks?.()` yazıyordu — ama mağazada
              `fetchTasks` DİYE BİR ŞEY YOK. Soru işareti (`?.`) bunu sessizce yutuyordu:
              satır hiçbir şey yapmıyor, yaptığını sanıyorduk. Kullanıcı kilit ekranından
              görevi tamamlıyor, sunucu güncelleniyor ama uygulama görevi hâlâ açık
              gösteriyordu.

              Hemen altındaki alışkanlık dalı bunu zaten DOĞRU yapıyor (mağazayı
              doğrudan yazıyor); görev dalı o desenin dışında kalmış.
            */
            const taskId = Number(data.taskId);
            require('@/features/tasks').useTaskStore.getState()
              .updateTask(taskId, { isCompleted: true, completedAt: new Date().toISOString() });
          } catch (e) { swallow('layout.notifActionCompleteTask', e, { capture: true }); }
          return;
        }

        // Watch/Lock Screen: "⏰ 15 Dk Ertele" (reschedule notification 15m later)
        if (action === 'task-snooze' && data.taskId) {
          try {
            const snoozeTime = new Date();
            snoozeTime.setMinutes(snoozeTime.getMinutes() + 15);
            
            Notifs.scheduleNotificationAsync({
              content: {
                title: response?.notification?.request?.content?.title ?? 'TAZQ Reminder',
                body: response?.notification?.request?.content?.body ?? '',
                data: data,
                categoryIdentifier: 'task-reminder',
              },
              /*
                TETİKLEYİCİ NESNE OLMALI — ham `Date` DEĞİL.

                Burada `trigger: snoozeTime` yazıyordu. expo-notifications 53'ten beri
                ham bir tarih kabul etmiyor; uygulamanın kendi bildirim dosyasındaki
                ON'A YAKIN çağrının hepsi `{ type: 'date', date }` biçimini kullanıyor
                (bkz. shared/utils/notifications.ts). Yani "15 dakika ertele" ya hiç
                kurulmuyor ya da anında geri geliyordu — ve alttaki sessiz `catch`
                hatayı da yutuyordu, yani kimse fark edemiyordu.
              */
              trigger: { type: 'date', date: snoozeTime },
            }).catch((e: unknown) => swallow('layout.notifActionSnoozeSchedule', e, { capture: true }));
          } catch (e) { swallow('layout.notifActionSnoozeReschedule', e, { capture: true }); }
          return;
        }

        // Watch: "✅ Tamamladım" on habit reminder
        if (action === 'habit-complete' && data.habitId) {
          const { toggleDate, habits: h } = useHabitStore.getState();
          const habit = h.find((x: any) => x.id === data.habitId);
          if (habit) {
            const todayKey = fmtDateKey(new Date());
            if (!(habit.completedDates ?? []).includes(todayKey)) {
              toggleDate(data.habitId, todayKey);
            }
          }
          // Habits done — cancel at-risk warning for today
          cancelHabitAtRisk();
          return;
        }

        // Watch: "⏹ Durdur" on focus notification
        if (action === 'focus-stop') {
          useFocusStore.getState().setIsActive(false);
          return;
        }

        // Watch: "📋 Planı Görüntüle" on exam countdown
        if (action === 'exam-open' && isLoggedIn) {
          router.push('/modlar');
          return;
        }

        // Morning brief → "▶️ Odak Başlat"
        if (action === 'start-focus' && isLoggedIn) {
          router.push('/focus');
          return;
        }

        // Any "📋 Görevler / Görevlere Git" action
        if (action === 'open-tasks' && isLoggedIn) {
          router.push('/tasks');
          return;
        }

        // Default tap → deep link based on notification data
        if (!isLoggedIn) return;
        const taskId = data.taskId;
        if (taskId) {
          router.push({ pathname: '/tasks', params: { highlightId: String(taskId) } });
        } else if (data.type === 'morning-brief' || data.type === 'evening-brief') {
          // Sabah: günü kur. Akşam: günü kapat. İkisi de aynı ekranda.
          router.push('/gun');
        } else if (data.type === 'focus') {
          router.push('/focus');
        } else if (data.type === 'habit-risk' || data.type === 'habit-reminder') {
          router.push('/cockpit');
        } else if (data.type === 'weekly') {
          router.push('/report');
        } else {
          router.push('/tasks');
        }
      });
    } catch (e) { swallow('layout.notificationResponseHandler', e); }
    return () => { try { sub?.remove?.(); } catch (e) { swallow('layout.notificationSubscriptionRemove', e); } };
  }, [isLoggedIn]);

  // Auth Guard & Initialization
  useEffect(() => {
    if (!_hasHydrated) return;

    const timer = setTimeout(async () => {
      // Read segments inside effect so we always get current value,
      // but don't add segments to deps — we don't want to re-fire on every navigation
      const currentSegments = segments;
      const seg = currentSegments[0];
      const inAuthGroup = seg === 'login' || seg === 'register';
      // Nötr ekranlar: hem girişli hem girişsiz görülebilir (legal sayfaları, e-posta doğrulama).
      // Guard bunlara dokunmamalı — yoksa girişli kullanıcı legal'a girince dashboard'a geri atılır.
      const isNeutral = seg === 'legal' || seg === 'verify-email';
      const inOnboarding = seg === 'onboarding';

      try {
        if (isNeutral) { setIsInitialized(true); return; }

        const onboardingDone = await AsyncStorage.getItem('tazq-onboarding-done');

        // If onboarding not done, force onboarding
        if (onboardingDone !== 'true' && !inOnboarding) {
          router.replace('/onboarding');
        }
        // If logged in and in auth/onboarding, go to home
        else if (isLoggedIn && onboardingDone === 'true' && (inAuthGroup || inOnboarding)) {
          router.replace('/');
        }
        /*
          MİSAFİR UYGULAMAYI KULLANABİLİR.

          Bu kapı eskiden yalnız `isLoggedIn`e bakıyordu ve onboarding'i bitiren
          herkesi /login'e atıyordu — yani bir yapılacaklar uygulamasını denemek için
          önce hesap açmak gerekiyordu. Oysa çekirdek (görev · alışkanlık · odak)
          zaten offline-first; kayıt duvarı teknik bir zorunluluk değildi.

          Misafir onboarding'e ya da giriş ekranına ZORLA gönderilmez; oraya kendi
          isteğiyle gider (Ayarlar → Hesap oluştur).
        */
        else if (!isLoggedIn && !isGuest && onboardingDone === 'true' && !inAuthGroup && !inOnboarding) {
          router.replace('/login');
        }
        setIsInitialized(true);
      } catch (e) {
        swallow('layout.authGuard', e, { capture: true });
      }
    }, 50);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isLoggedIn, isGuest, segments]);

  // BR-01: Recover focus session that ended while app was killed or backgrounded
  useEffect(() => {
    const checkTimerRehydration = () => {
      const { isActive, lastActiveAt, totalSeconds, seconds, currentTask } = useFocusStore.getState();
      if (!isActive || !lastActiveAt) return;
      const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
      const remaining = seconds - elapsed; // use current remaining, not total (handles pause/resume)
      if (remaining <= 0) {
        // Seans süresi arka planda dolmuş. Ancak "bitişten ne kadar SONRA" geri dönüldüğüne bak:
        // makul bir pencere içindeyse (kullanıcı telefonu bırakıp odaklanmış, sonra dönmüş) → kaydet.
        // Çok geç dönülmüşse (uygulama çöktü/kapandı ve çok sonra açıldı) → sahte "tamamlandı" kredisi verme.
        const overshoot = elapsed - seconds; // bitişin üstünden geçen saniye
        const GRACE_SECONDS = 30 * 60; // 30 dk tolerans
        if (overshoot <= GRACE_SECONDS) {
          const minutes = Math.max(1, Math.round(totalSeconds / 60));
          FocusService.saveSession(currentTask || 'Focus', minutes, true).catch((e) => swallow('layout.saveSessionOnBackground', e, { capture: true }));
        }
        // Her durumda timer'ı sıfırla (kredi verilmese bile takılı kalmasın)
        useFocusStore.setState({ isActive: false, seconds: 0, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null });
      } else {
        // Session still in progress — rehydrate with correct remaining time
        useFocusStore.getState().rehydrateTimer();
      }
    };

    // Run on startup
    checkTimerRehydration();

    // Run when app returns to foreground
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkTimerRehydration();
      } else {
        // Arka plana geçerken bekleyen alt görev yazmalarını HEMEN gönder: 800 ms'lik
        // toplama penceresi dolmadan uygulamadan çıkan kullanıcının son dokunuşu
        // kaybolmasın (yazma yalnız gecikmeli, yerel güncelleme zaten anında).
        try {
          require('@/features/tasks/utils/subtaskSync').flushPendingSubtasks();
        } catch (e) { swallow('layout.flushPendingSubtasks', e, { capture: true }); }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Purge completion journal entries older than 90 days on launch
  useEffect(() => {
    if (isLoggedIn) {
      useCompletionStore.getState().purgeOlderThan(90);
    }
  }, [isLoggedIn]);

  // Sync user profile after hydration — ensures we use the restored token, not the initial null
  useEffect(() => {
    if (!_hasHydrated) return;
    const syncProfile = async () => {
      const { token: t, refreshToken: rt, isLoggedIn: loggedIn } = useAuthStore.getState();
      if (!loggedIn) {
        // Stale token in store but session is not active — clear it so the
        // request interceptor cannot accidentally inject it into login requests.
        if (t) useAuthStore.setState({ token: null });
        return;
      }
      // Hem access hem refresh token yoksa kurtarılamaz → çıkış. Refresh token
      // varsa süresi dolmuş/eksik access token interceptor tarafından yenilenir.
      if (!t && !rt) {
        logout();
        return;
      }
      try {
        const userData = await AuthService.getCurrentUser();
        if (userData) setUser(userData);
      } catch (error: unknown) {
        // 401 tek başına yeterli değil: araya giren katman token'ı yenilemeyi denedi ve
        // BAŞARISIZ olduysa bunun sebebi "token geçersiz" değil "sunucuya ulaşılamadı"
        // olabilir. O durumda hata `__authTransient` ile işaretlenip oturum bilerek
        // korunuyor; burada da saygı gösterilmeli, yoksa korunan oturumu biz kapatırız
        // ve `clearLocalUserData` bekleyen çevrimdışı değişiklikleri siler.
        const transient = (error as { __authTransient?: boolean })?.__authTransient === true;
        if (httpStatusOf(error) === 401 && !transient) {
          logout();
        } else {
          // Ağ/sunucu hatası ya da geçici yenileme başarısızlığı → oturumu koru.
          swallow('layout.sessionSync', error);
        }
      }
    };
    syncProfile();
  }, [_hasHydrated]);

  /*
    Android Navigation Bar & System UI Sync.

    SPLASH AÇIKKEN MARKA RENGİ: açılış ekranı artık temadan bağımsız lacivert
    (bkz. BRAND_SPLASH_BG). Sistem çubukları tema rengiyle kalsaydı, açık temada
    ekranın dibinde beyaz bir şerit, lacivert zeminin altında asılı dururdu — yani
    sıçramayı ekranın kenarından geri getirirdi.
  */
  useEffect(() => {
    /*
      SİSTEM ÇUBUKLARI HER ZAMAN UYGULAMANIN TEMASINI İZLER.

      Bir tur, açılış boyunca işletim sisteminin görünümü izlendi (açılış ekranı da
      öyle yapıyordu). Kullanıcı tablette sonucunu gösterdi: TAZQ'yu AÇIK temada
      kullanan biri, sistemi koyuysa koyu bir açılış ve okunmayan bir durum çubuğu
      görüyordu — açık zemin üstünde açık renk simgeler.

      Açılış ekranı artık zemini sistem renginden uygulamanınkine 240ms'de geçiriyor
      (bkz. AnimatedSplash → köprü), yani ayrı bir kural gerekmiyor: tek kaynak tema.
    */
    const dark = isDark;
    const backgroundColor = dark ? Colors.dark.background : '#FFFFFF';
    const navStyle = dark ? 'light' : 'dark';
    safeSystemUI(backgroundColor);
    safeNavigationBar(navStyle, backgroundColor);
  }, [isDark]);

  if (showSplash || !fontsLoaded || !assetsLoaded) {
    return (
      <>
        {/* Durum çubuğu da UYGULAMANIN teması — açılış zemini oraya geçiyor. */}
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AnimatedSplash
          // Splash, uygulama GERÇEKTEN hazır olana kadar kaybolmaz. Eskiden sabit
          // süreli animasyon bitince saydama geçiyordu; yavaş açılışta kullanıcı
          // boş ekrana bakıyordu (splash oradaydı ama görünmezdi).
          ready={fontsLoaded && assetsLoaded}
          onFinish={() => setShowSplash(false)}
          onReady={() => {
            // This ensures the native splash only hides when our custom splash is visible
            SplashScreen.hideAsync().catch(() => {});
          }}
        />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
    <ErrorBoundary>
    <SafeAreaProvider>
      <TourProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

        {/* iOS PageSheet derinliği: bir sheet açılınca arka ekran küçülüp köşeleri
            yuvarlanır ve kararır (uiDepth 0→1). RN Modal'lar üstte kalır → arka plan geri iter. */}
        <Animated.View
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: uiDepth.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }),
            transform: [{ scale: uiDepth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) }],
          }}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade_from_bottom',
            }}
          >
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="login" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="register" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="verify-email" options={{ gestureEnabled: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="tasks" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="cockpit" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="modlar" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="promo" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="report" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: uiDepth.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) }]} />
        </Animated.View>

        <FocusIsland />
        <Toast />
        {/*
          Bağlantı kesildi bandı — KÜRESEL, her ekranın üstünde. Bileşen yazılmış ama
          hiçbir yere bağlanmamıştı: uygulama çevrimdışı işlemleri kuyruğa alıyor,
          bazı yollar sessizce alıyor, kullanıcı ise neden senkron olmadığını
          bilmiyordu. Tek yerde durması gerekiyor — her ekrana ayrı koymak
          kaçınılmaz olarak birinde unutulur.
        */}
        <OfflineBanner />
        <CelebrationOverlay />
        <ConfettiOverlay />
        <RocketFeedback />
        <CustomAlertModal />
        <NotificationPrimer
          visible={showNotifPrimer}
          onEnable={async () => {
            usePrefsStore.getState().setNotifPrimerSeen(true);
            const granted = await requestNotificationPermissions();
            setNotifPermission(granted ? 'granted' : 'denied');
          }}
          onDismiss={() => usePrefsStore.getState().setNotifPrimerSeen(true)}
        />
      </View>
      </TourProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


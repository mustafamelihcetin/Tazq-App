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
    console.warn('[Google Sign-In] Native module "RNGoogleSignin" not found. Google Sign-In is disabled.');
  }
} catch (e) {
  console.warn('[Google Sign-In] Error initializing Google Sign-In:', e);
}

// Initialize crash reporting as early as possible — before any other imports
import { initSentry } from '@/shared/utils/sentry';
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
import { AuthService, FocusService, api } from '@/shared/services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TourProvider } from '@/shared/components/TourContext';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { syncTasksAndHabitsLanguage } from '@/shared/utils/systemTaskTranslator';
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
import { CelebrationOverlay } from '@/shared/components/CelebrationOverlay';
import { ConfettiOverlay } from '@/shared/components/ConfettiOverlay';
import { CustomAlertModal } from '@/shared/components/CustomAlert';
import { RocketFeedback } from '@/shared/components/RocketFeedback';
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
  const { isLoggedIn, token, setUser, logout, _hasHydrated } = useAuthStore();
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
  const { morningBrief: morningBriefEnabled, eveningBrief: eveningBriefEnabled, productivityHour } = usePrefsStore();
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
        console.warn('Asset preloading failed:', e);
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

    // Show notification only when app is already in background at focus start
    if (AppState.currentState !== 'active') {
      const { seconds: initSecs, currentTask } = useFocusStore.getState();
      showFocusNotification(currentTask, initSecs, language || 'en');
    }

    const interval = setInterval(() => {
      const { seconds, tick, currentTask: task, isActive } = useFocusStore.getState();
      if (!isActive || seconds <= 0) return;
      tick();
      // Update notification once per minute, only when backgrounded
      if (seconds % 60 === 0 && AppState.currentState !== 'active') {
        showFocusNotification(task, seconds, language || 'en');
      }
    }, 1000);

    // Show notification when app goes to background; dismiss when it returns
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const { seconds, currentTask } = useFocusStore.getState();
        if (useFocusStore.getState().isActive) {
          showFocusNotification(currentTask, seconds, language || 'en');
        }
      } else if (nextState === 'active') {
        cancelFocusNotification();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      cancelFocusNotification();
    };
  }, [focusActive]);

  // Register notification categories + schedule daily morning/evening briefs
  useEffect(() => {
    if (!isLoggedIn) return;
    requestNotificationPermissions().then((granted) => {
      if (!granted) return;
      registerNotificationCategories();

      const allTasks = tasks;
      const today = new Date().toDateString();
      const todayTasks = allTasks.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).toDateString() === today;
      });
      const pending = allTasks.filter(t => !t.isCompleted).length;
      const completedToday = allTasks.filter(t => {
        if (!t.isCompleted || !t.completedAt) return false;
        return new Date(t.completedAt).toDateString() === today;
      }).length;

      // Habit streak from cockpit store — best-effort
      let streak = 0;
      try {
        const { habits } = require('@/features/habits').useHabitStore.getState();
        streak = habits?.reduce((max: number, h: any) => Math.max(max, h.streak ?? 0), 0) ?? 0;
      } catch (_) {}

      // Morning brief: today's task count + streak (respects user preference)
      if (morningBriefEnabled) {
        scheduleMorningBrief(todayTasks.length, streak, language || 'en', productivityHour);
      } else {
        cancelMorningBrief();
      }

      // Evening brief: completed today vs still pending (respects user preference)
      if (eveningBriefEnabled) {
        scheduleEveningBrief(completedToday, pending, language || 'en');
      } else {
        cancelEveningBrief();
      }
    });
  }, [isLoggedIn]);


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
            taskApi.patch(`/tasks/${data.taskId}`, { isCompleted: true }).catch(() => {});
            // Refresh local store
            require('@/features/tasks').useTaskStore.getState().fetchTasks?.();
          } catch (_) {}
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
              trigger: snoozeTime,
            }).catch(() => {});
          } catch (_) {}
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
    } catch (_) {}
    return () => { try { sub?.remove?.(); } catch (_) {} };
  }, [isLoggedIn]);

  // Auth Guard & Initialization
  useEffect(() => {
    if (!_hasHydrated) return;

    const timer = setTimeout(async () => {
      // Read segments inside effect so we always get current value,
      // but don't add segments to deps — we don't want to re-fire on every navigation
      const currentSegments = segments;
      const inAuthGroup = currentSegments[0] === 'login' || currentSegments[0] === 'register' || currentSegments[0] === 'legal';
      const inOnboarding = currentSegments[0] === 'onboarding';

      try {
        const onboardingDone = await AsyncStorage.getItem('tazq-onboarding-done');

        // If onboarding not done, force onboarding
        if (onboardingDone !== 'true' && !inOnboarding) {
          router.replace('/onboarding');
        }
        // If logged in and in auth/onboarding, go to home
        else if (isLoggedIn && onboardingDone === 'true' && (inAuthGroup || inOnboarding)) {
          router.replace('/');
        }
        // If not logged in and not in auth/onboarding, go to login
        else if (!isLoggedIn && onboardingDone === 'true' && !inAuthGroup && !inOnboarding) {
          router.replace('/login');
        }
        setIsInitialized(true);
      } catch (e) {
        console.warn('Auth guard check failed:', e);
      }
    }, 50);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isLoggedIn]);

  // BR-01: Recover focus session that ended while app was killed or backgrounded
  useEffect(() => {
    const checkTimerRehydration = () => {
      const { isActive, lastActiveAt, totalSeconds, seconds, currentTask } = useFocusStore.getState();
      if (!isActive || !lastActiveAt) return;
      const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
      const remaining = seconds - elapsed; // use current remaining, not total (handles pause/resume)
      if (remaining <= 0) {
        // Session would have finished — save it and reset
        const minutes = Math.max(1, Math.round(totalSeconds / 60));
        FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
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
      } catch (error: any) {
        if (error.response?.status === 401) {
          logout();
        } else {
          // Network/server error — don't logout, keep local session
          console.warn('Session sync failed (keeping session):', error.message);
        }
      }
    };
    syncProfile();
  }, [_hasHydrated]);

  // Android Navigation Bar & System UI Sync
  useEffect(() => {
    const backgroundColor = isDark ? '#09090B' : '#FFFFFF';
    const navStyle = isDark ? 'light' : 'dark';
    safeSystemUI(backgroundColor);
    safeNavigationBar(navStyle, backgroundColor);
  }, [isDark]);

  if (showSplash || !fontsLoaded || !assetsLoaded) {
    return (
      <AnimatedSplash
        isDark={isDark}
        onFinish={() => setShowSplash(false)}
        onReady={() => {
          // This ensures the native splash only hides when our custom splash is visible
          SplashScreen.hideAsync().catch(() => {});
        }}
      />
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
            <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="tasks" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="cockpit" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="modlar" options={{ gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="report" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: uiDepth.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) }]} />
        </Animated.View>

        <FocusIsland />
        <Toast />
        <CelebrationOverlay />
        <ConfettiOverlay />
        <RocketFeedback />
        <CustomAlertModal />
      </View>
      </TourProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


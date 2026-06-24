import 'react-native-gesture-handler';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

// Initialize crash reporting as early as possible — before any other imports
import { initSentry } from '../utils/sentry';
initSentry();

import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View, LogBox, AppState, Text, TextInput } from 'react-native';
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
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService, FocusService, api } from '../services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { initIntelligence } from '../utils/taskIntelligence';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
} from '../utils/notifications';
import { useTaskStore } from '../store/useTaskStore';
import { useFocusStore } from '../store/useFocusStore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { OfflineBanner } from '../components/OfflineBanner';
import { FocusIsland } from '../components/FocusIsland';
import { Toast } from '../components/Toast';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { CustomAlertModal } from '../components/CustomAlert';
import { Asset } from 'expo-asset';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { usePlanAdaptations } from '../hooks/usePlanAdaptations';

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

import { useFonts, PlusJakartaSans_800ExtraBold, PlusJakartaSans_700Bold, PlusJakartaSans_600SemiBold, PlusJakartaSans_800ExtraBold_Italic } from '@expo-google-fonts/plus-jakarta-sans';
import { useHabitStore, fmtDateKey } from '../store/useHabitStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useCompletionStore } from '../store/useCompletionStore';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
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
          require('../assets/images/tazq_icon.png'),
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
        const { habits } = require('../store/useHabitStore').useHabitStore.getState();
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
    if (isExpoGo) return;
    let sub: any;
    try {
      const Notifs = require('expo-notifications');
      sub = Notifs.addNotificationResponseReceivedListener((response: any) => {
        const action = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data ?? {};

        // Watch/Lock Screen: "✅ Tamamla" on task reminder (mark complete silently)
        if (action === 'task-complete' && data.taskId) {
          try {
            const { api: taskApi } = require('../services/api');
            taskApi.patch(`/tasks/${data.taskId}`, { isCompleted: true }).catch(() => {});
            // Refresh local store
            require('../store/useTaskStore').useTaskStore.getState().fetchTasks?.();
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

        // If not logged in and onboarding not done, force onboarding
        if (!isLoggedIn && onboardingDone !== 'true' && !inOnboarding) {
          router.replace('/onboarding');
        }
        // If logged in and in auth/onboarding, go to home
        else if (isLoggedIn && (inAuthGroup || inOnboarding)) {
          router.replace('/');
        }
        // If not logged in and not in auth/onboarding, go to login
        else if (!isLoggedIn && !inAuthGroup && !inOnboarding) {
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

  // BR-01: Recover focus session that ended while app was killed
  useEffect(() => {
    const { isActive, lastActiveAt, totalSeconds, seconds, currentTask } = useFocusStore.getState();
    if (!isActive || !lastActiveAt) return;
    const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
    const remaining = seconds - elapsed; // use current remaining, not total (handles pause/resume)
    if (remaining <= 0) {
      // Session would have finished — save it and reset
      const minutes = Math.max(1, Math.round(totalSeconds / 60));
      FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
      useFocusStore.setState({ isActive: false, seconds: 0, lastActiveAt: null });
    } else {
      // Session still in progress — rehydrate with correct remaining time
      useFocusStore.getState().rehydrateTimer();
    }
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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

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
        </Stack>

        <OfflineBanner />
        <FocusIsland />
        <Toast />
        <CelebrationOverlay />
        <CustomAlertModal />
      </View>
    </SafeAreaProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


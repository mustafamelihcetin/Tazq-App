import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View, LogBox, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService, FocusService, api } from '../services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { initIntelligence } from '../utils/taskIntelligence';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { scheduleShutdownNotification, requestNotificationPermissions, showFocusNotification, cancelFocusNotification, registerNotificationCategories } from '../utils/notifications';
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
import { Asset } from 'expo-asset';

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

const safeNavigationBar = async (color: string, style: 'light' | 'dark') => {
  if (Platform.OS !== 'android' || isExpoGo) return;
  try {
    const NavigationBar = require('expo-navigation-bar');
    if (NavigationBar && NavigationBar.setBackgroundColorAsync) {
      await NavigationBar.setBackgroundColorAsync(color);
      await NavigationBar.setButtonStyleAsync(style);
      await NavigationBar.setBehaviorAsync('overlay-pan');
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
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const { sync, language } = useLanguageStore();
  const { tasks } = useTaskStore();
  const focusActive = useFocusStore((s) => s.isActive);

  // Preload all critical assets
  useEffect(() => {
    async function prepare() {
      try {
        // Preload logo images to prevent flashing
        await Asset.loadAsync([
          require('../assets/images/tazq_icon.png'),
          require('../assets/images/tazq_logo_v2_white.png'),
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

  // Schedule daily shutdown notification + register Watch-compatible categories
  useEffect(() => {
    if (!isLoggedIn) return;
    requestNotificationPermissions().then((granted) => {
      if (!granted) return;
      // Register action categories — these appear as buttons on Apple Watch too
      registerNotificationCategories();
      const pending = tasks.filter(t => !t.isCompleted).length;
      scheduleShutdownNotification(pending, language || 'en');
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
          return;
        }

        // Watch: "⏹ Durdur" on focus notification
        if (action === 'focus-stop') {
          useFocusStore.getState().setIsActive(false);
          return;
        }

        // Watch: "📋 Planı Görüntüle" on exam countdown
        if (action === 'exam-open' && isLoggedIn) {
          router.push('/profile');
          return;
        }

        // Default tap → deep link
        if (!isLoggedIn) return;
        const taskId = data.taskId;
        if (taskId) {
          router.push({ pathname: '/tasks', params: { highlightId: String(taskId) } });
        } else if (data.type === 'focus') {
          router.push('/focus');
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
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
      const inOnboarding = segments[0] === 'onboarding';

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
  }, [_hasHydrated, isLoggedIn, segments, router]);

  // BR-01: Recover focus session that ended while app was killed
  useEffect(() => {
    const { isActive, lastActiveAt, totalSeconds, seconds, currentTask } = useFocusStore.getState();
    if (!isActive || !lastActiveAt) return;
    const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
    const remaining = totalSeconds - elapsed;
    if (remaining <= 0) {
      // Session would have finished — save it and reset
      const minutes = Math.max(1, Math.round(totalSeconds / 60));
      FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
      useFocusStore.setState({ isActive: false, seconds: 0, lastActiveAt: null });
    }
  }, []);

  // Sync user profile on mount if token exists
  useEffect(() => {
    const syncProfile = async () => {
      if (token && isLoggedIn) {
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
      }
    };
    syncProfile();
  }, []);

  // Android Navigation Bar & System UI Sync
  useEffect(() => {
    /* 
       Temporarily disabled for Expo Go SDK 55 stability.
       Re-enable these when moving to a Custom Development Build.
    */
    /*
    const isDarkTheme = colorScheme === 'dark';
    const backgroundColor = isDarkTheme ? '#09090B' : '#FFFFFF';
    const navStyle = isDarkTheme ? 'light' : 'dark';

    safeSystemUI(backgroundColor);
    safeNavigationBar(backgroundColor, navStyle);
    */
  }, [colorScheme]);

  if (showSplash || !fontsLoaded || !assetsLoaded) {
    return (
      <AnimatedSplash 
        onFinish={() => setShowSplash(false)} 
        onReady={() => {
          // This ensures the native splash only hides when our custom splash is visible
          SplashScreen.hideAsync().catch(() => {});
        }} 
      />
    );
  }

  return (
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
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="register" />
          <Stack.Screen name="index" options={{ gestureEnabled: false }} />
          <Stack.Screen name="tasks" options={{ gestureEnabled: false }} />
          <Stack.Screen name="cockpit" />
        </Stack>

        <OfflineBanner />
        <FocusIsland />
        <Toast />
        <CelebrationOverlay />
      </View>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}


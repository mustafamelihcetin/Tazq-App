import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService, api } from '../services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { initIntelligence } from '../utils/taskIntelligence';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { scheduleShutdownNotification, requestNotificationPermissions } from '../utils/notifications';
import { useTaskStore } from '../store/useTaskStore';
import i18n from 'i18n-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplash } from '../components/AnimatedSplash';
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
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-BoldItalic': PlusJakartaSans_800ExtraBold_Italic,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
    'Syne-Bold': Syne_700Bold,
    'Syne-ExtraBold': Syne_800ExtraBold,
  });

  const { theme, colorScheme, isDark } = useAppTheme();
  const { isLoggedIn, token, setUser, logout, _hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const { sync } = useLanguageStore();
  const { tasks } = useTaskStore();

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

  // Schedule daily shutdown notification when user is logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    requestNotificationPermissions().then((granted) => {
      if (!granted) return;
      const pending = tasks.filter(t => !t.isCompleted).length;
      scheduleShutdownNotification(pending, i18n.locale || 'en');
    });
  }, [isLoggedIn]);

  // Notification tap → deep link (skipped in Expo Go, active in dev/prod builds)
  useEffect(() => {
    if (isExpoGo) return;
    let sub: any;
    try {
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const taskId = response?.notification?.request?.content?.data?.taskId;
        if (taskId && isLoggedIn) {
          router.push({ pathname: '/tasks', params: { action: 'add' } });
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
        </Stack>
      </View>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}


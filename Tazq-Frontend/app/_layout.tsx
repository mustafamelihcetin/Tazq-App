import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, View, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService } from '../services/api';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLanguageStore } from '../store/useLanguageStore';
import { initIntelligence } from '../utils/taskIntelligence';

// Susturulacak kütüphane uyarıları
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
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

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { isLoggedIn, token, setUser, logout } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const { sync } = useLanguageStore();

  // Wait for fonts to load and sync language
  useEffect(() => {
    if (fontsLoaded) {
      sync();
      initIntelligence();
    }
  }, [fontsLoaded]);

  // Auth Guard & Initialization
  useEffect(() => {
    const timer = setTimeout(async () => {
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
      const inOnboarding = segments[0] === 'onboarding';

      const onboardingDone = await AsyncStorage.getItem('tazq-onboarding-done');
      
      // If not logged in and onboarding not done, force onboarding
      if (!isLoggedIn && onboardingDone !== 'true' && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      // If not logged in and not in auth group or onboarding, go to login
      if (!isLoggedIn && !inAuthGroup && !inOnboarding) {
        router.replace('/login');
      } else if (isLoggedIn && inAuthGroup) {
        router.replace('/');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isLoggedIn, segments, router]);

  // Sync user profile on mount if token exists
  useEffect(() => {
    const syncProfile = async () => {
      if (token && isLoggedIn) {
        try {
          const userData = await AuthService.getCurrentUser();
          if (userData) setUser(userData);
        } catch (error: any) {
          if (error.response?.status !== 401) {
            console.warn('Session sync failed:', error.message);
          }
          logout();
        }
      }
    };
    syncProfile();
  }, []);

  return (
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
  );
}

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/useAuthStore';
import { AuthService } from '../services/api';
import '../global.css';

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { isLoggedIn, token, setUser, logout } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Auth Guard & Initialization
  useEffect(() => {
    // Small delay to ensure segments and router are fully ready
    const timer = setTimeout(() => {
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

      if (!isLoggedIn && !inAuthGroup) {
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
        } catch (error) {
          console.error('Session sync failed:', error);
          logout();
        }
      }
    };
    syncProfile();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="register" />
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

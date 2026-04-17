import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { Colors } from '../constants/Colors';
import '../global.css';

// Animasyonlu arkaplanı şimdilik devre dışı bırakıyoruz ki uygulama açılsın
export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

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
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}

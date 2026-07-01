import { useColorScheme } from 'react-native';
import { Colors } from '@/shared/constants/Colors';
import { useThemeStore } from '@/shared/store/useThemeStore';

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const { theme: manualTheme } = useThemeStore();

  const colorScheme = manualTheme === 'system' 
    ? (systemColorScheme ?? 'light') 
    : manualTheme;
  
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return {
    theme,
    colorScheme: colorScheme as 'light' | 'dark',
    isDark: colorScheme === 'dark',
    setTheme: useThemeStore.getState().setTheme,
    currentSetting: manualTheme
  };
}

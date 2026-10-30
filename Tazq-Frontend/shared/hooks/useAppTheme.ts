import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, accentOf } from '@/shared/constants/Colors';
import { useThemeStore } from '@/shared/store/useThemeStore';

/*
  Tema = nötr taban (Colors) + kullanıcının VURGU paleti (AccentPalettes). Vurgu yalnız birincil
  token'ları değiştirir; yüzey, metin ve durum renkleri (başarı/hata/uyarı) sabit kalır.
  Varsayılan: marka mavisi birebir — seçim yapmayan için hiçbir şey değişmez.
*/
export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const manualTheme = useThemeStore(s => s.theme);
  const accentId = useThemeStore(s => s.accent);

  const colorScheme = manualTheme === 'system'
    ? (systemColorScheme ?? 'light')
    : manualTheme;

  const theme = useMemo(() => {
    const base = colorScheme === 'dark' ? Colors.dark : Colors.light;
    const a = accentOf(accentId);
    return { ...base, ...(colorScheme === 'dark' ? a.dark : a.light) };
  }, [colorScheme, accentId]);

  return {
    theme,
    colorScheme: colorScheme as 'light' | 'dark',
    isDark: colorScheme === 'dark',
    setTheme: useThemeStore.getState().setTheme,
    currentSetting: manualTheme
  };
}

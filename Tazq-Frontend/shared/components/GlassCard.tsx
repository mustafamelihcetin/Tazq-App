import React from 'react';
import { S, R, B } from '@/shared/constants/tokens';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { GlassSurface } from '@/shared/components/GlassSurface';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /**
   * Kart bir modalın içinde, sayfanın ÜSTÜNDE mi yüzüyor?
   *
   * Sayfaya gömülü kart (giriş formu) opak kalır — içeriğin parçasıdır. Üstte yüzen
   * kart (şifremi unuttum penceresi) ise diğer bütün modallar gibi cam yüzeydir.
   */
  floating?: boolean;
}

export const GlassCard = ({ children, style, floating = false }: GlassCardProps) => {
  // UYGULAMA temasını izle (cihaz temasını değil) — aksi halde kullanıcı uygulamayı koyu
  // yapıp cihaz açıkken kart bembeyaz kalıyordu (login/register'da göze batan uyumsuzluk).
  const { theme, isDark } = useAppTheme();

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: floating ? 'transparent' : (isDark ? '#17171C' : theme.surfaceContainerLow),
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
      },
      floating && { borderRadius: R.sheet },
      style,
    ]}>
      {floating && <GlassSurface radius={R.sheet} />}
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: R.xl,
    borderWidth: B.thin,
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
  },
  inner: {
    padding: S.md,
  },
});

import React from 'react';
import { StyleProp, ViewStyle, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { ChevronLeft } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ICON, R, MIN_TOUCH, HAIRLINE } from '@/shared/constants/tokens';

/**
 * Cam geri butonu — BAŞLIKSIZ (header'sız) ekranlar için.
 *
 * NEDEN: başlıklı ekranlarda (ayarlar, rapor, arşiv, legal, admin) geri oku bir başlık
 * satırının içinde durur; satır ona bağlam ve çerçeve verir. Header'ı olmayan ekranlarda
 * (profil, kayıt, e-posta doğrulama) ok içeriğin üstünde ÇIPLAK asılı kalıyordu: neye ait
 * olduğu belirsiz, değişken zeminde (nokta desen, animasyonlu arka plan) kontrastı garantisiz.
 *
 * Çözüm Apple'ın deseni: içeriğin üstünde yüzen DAİRESEL CAM buton (Fotoğraflar/Safari'nin
 * kapat butonu). Altındaki içeriği bulanıklaştırır → her zeminde okunur kalır ama içeriği
 * örtmez; arkasındaki renk hafifçe sızdığı için ekrana ait hissettirir (opak bir daire
 * "yapıştırılmış" durur, cam "üstünde yüzer").
 *
 * Android'de BlurView yok → opak zemin + elevation (bkz. ScreenHeader, aynı desen).
 * iOS'ta zemin SAYDAM kalmalı, yoksa bulanıklık görünmez.
 */
export function BackButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, isDark, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();

  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={language === 'tr' ? 'Geri' : 'Back'}
      activeOpacity={0.7}
      style={[
        styles.btn,
        {
          backgroundColor: Platform.OS === 'android'
            ? (isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.94)')
            : 'transparent',
          // İnce cam kenarı — camın nerede bittiğini söyler, her iki zeminde de tanımlar.
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
          elevation: Platform.OS === 'android' ? 3 : 0,
        },
        style,
      ]}
    >
      {Platform.OS !== 'android' && (
        <BlurView intensity={isDark ? 40 : 60} tint={colorScheme} style={StyleSheet.absoluteFill} />
      )}
      <ChevronLeft size={ICON.lg} color={theme.onSurface} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    // Daire: Apple'ın yüzen cam butonu dairedir (yuvarlak kare "kart" hissi verir, "buton" değil).
    borderRadius: R.full,
    borderWidth: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // blur köşeleri daireye kessin
  },
});

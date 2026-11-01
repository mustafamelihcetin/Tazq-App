import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/*
  TAZQ KELİME İŞARETİ — uygulamanın her yerinde AYNI çizim (2026-11-01, kullanıcı: "son logomuzu uygulama
  içine gömdün mü? Bugün başlığında, girişte…"). Simge ve açılış ekranıyla aynı işçilikli harfler:
  açık zeminde grafit, koyu zeminde gümüş (assets/brand/splash_logo*.png).

  Kutu ölçüsü eskisiyle aynı (yükseklik h, genişlik 3.2h) — hiçbir yerleşim kaymaz. Görsel 1024 kare ve
  yazı ortada küçük bir şerit olduğu için kare kutu içinde kırpılarak yerleştirilir; yazının yüksekliği
  eskisiyle aynı (~0.54h).
*/
const MARK_SILVER = require('../../assets/brand/splash_logo.png');
const MARK_GRAPHITE = require('../../assets/brand/splash_logo_dark.png');
/** Ölçülmüş (bkz. AnimatedSplash): yazı 943×303, dikey merkezi 525/1024. */
const INK_H = 303 / 1024;
const INK_CY = 525 / 1024;
const INK_OF_BOX = 0.54;

interface TazqLogoProps {
  size?: number;
  height?: number;
  width?: number;
  style?: any;
  color?: string;
  showIcon?: boolean;
  // 'auto' = temaya göre; 'white'/'dark' = zorla (ör. koyu tanıtım zemininde her zaman gümüş).
  variant?: 'auto' | 'white' | 'dark';
}

export const TazqLogo: React.FC<TazqLogoProps> = ({
  size,
  height = 24,
  width,
  style,
  variant = 'auto',
}) => {
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const light = variant === 'white' ? true : variant === 'dark' ? false : isDark;

  const h = size || height;
  const w = width || h * 3.2;
  const side = (h * INK_OF_BOX) / INK_H;

  return (
    <View style={[styles.container, { width: w, height: h }, style]} accessible accessibilityRole="image" accessibilityLabel="TAZQ">
      <Image
        source={light ? MARK_SILVER : MARK_GRAPHITE}
        style={{ position: 'absolute', width: side, height: side, left: (w - side) / 2, top: h / 2 - side * INK_CY }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});

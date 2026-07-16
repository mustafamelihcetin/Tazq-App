import React from 'react';
import { View, StyleSheet } from 'react-native';
import { R, ICON } from '@/shared/constants/tokens';
import type { LucideIcon } from 'lucide-react-native';

/**
 * Çerçeveli ikon — iOS Ayarlar imzası: DOLU renkli kutu + BEYAZ monokrom glif.
 *
 * NEDEN TEK BİLEŞEN: uygulamada kutu ikonları her ekranda elle çiziliyordu
 * (`<View 34x34 bg=renk+'18'><renkli ikon></View>`) — soluk tint zemin + renkli glif,
 * Apple deseni değil. Ayrıca renk/beyaz eşleşmesi elle yapılınca "beyaz ikon soluk
 * zeminde saydam kaldı" hatası çıkıyordu.
 *
 * Bu bileşen o hatayı YAPISAL olarak imkânsız kılar: `color` ZORUNLU ve DOLU zemin
 * olur, glif HER ZAMAN beyaz. Beyaz-glif ancak dolu renkte anlamlıdır; ikisi hep birlikte.
 *
 * MİNİMALİST: emoji değil, monokrom glif. Emoji çok renkli/oyuncak; tek renkli glif
 * dolu kutuda profesyonel ve sakin durur (Apple'ın tüm sistem ikonları böyle).
 */
export interface AppIconProps {
  /** Lucide ikon bileşeni (ör. Bell, Moon). Emoji DEĞİL. */
  Icon: LucideIcon;
  /** Kutunun DOLU zemin rengi. Beyaz glif buna oturur — soluk tint verme. */
  color: string;
  /** Kutu boyutu (kare). */
  size?: number;
  /** Glif boyutu. */
  iconSize?: number;
  /** Köşe yarıçapı — varsayılan R.sm (yuvarlak kare). Daire için R.full. */
  radius?: number;
}

export function AppIcon({ Icon, color, size = 34, iconSize = ICON.md, radius = R.sm }: AppIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius, backgroundColor: color }]}>
      {/* Glif HER ZAMAN beyaz — kural, seçenek değil. strokeWidth biraz kalın:
          beyaz glif dolu renkte, ince çizgi zayıf kalır (Apple SF Symbols de dolgun). */}
      <Icon size={iconSize} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

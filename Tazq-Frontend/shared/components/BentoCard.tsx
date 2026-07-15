import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

interface BentoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  glass?: boolean;
  onPress?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({ children, style, index = 0, glass = false, onPress }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const card = (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[
        styles.card,
        {
          // Kartı zeminden AYIRAN şey kontrast: açık temada beyaz kart / gri zemin,
          // koyu temada bir ton açık yüzey + hairline çerçeve. Bu, iOS'un "grouped
          // inset list" deseninin ta kendisi (Ayarlar, Hatırlatıcılar).
          backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
          borderColor: isDark ? theme.outline : 'transparent',
          borderWidth: isDark ? B.thin : 0,
          // GÖLGE YOK — bilinçli. iOS gruplanmış içeriği gölgelemez; gölge, Material
          // Design'ın "yükseklik" metaforudur. Kontrast zaten ayırıyorken gölge eklemek
          // kartları zeminde "yüzdürüyordu" ve web/Android dilinde konuşuyordu.
          // (Eskiden: shadowRadius 16, offset y=6 + elevation.)
          padding: S.lg,
          borderRadius: R.md,   // iOS kart standardı (eskiden R.lg = 24, fazla yuvarlaktı)
        },
        style,
      ]}
    >
      {glass && (
        <BlurView
          intensity={isDark ? 20 : 40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </MotiView>
  );

  if (onPress) {
    // accessibilityLabel bilerek verilmiyor: etiket cocuk <Text>lerden turetilsin.
    // Elle etiket vermek kartin gercek icerigini ezer ve ekran okuyucuyu yanlis bilgilendirir.
    return <Touchable accessibilityRole="button" onPress={onPress} activeOpacity={0.85}>{card}</Touchable>;
  }
  return card;
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});

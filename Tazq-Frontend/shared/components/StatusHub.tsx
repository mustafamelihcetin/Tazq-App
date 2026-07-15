import React from 'react';
import { S, ICON, R, B, MIN_TOUCH } from '@/shared/constants/tokens';
import { StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { Gauge, Activity } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Touchable } from '@/shared/components/Touchable';

/**
 * Başlıktaki durum düğmesi — haftalık odak skoru ve analitiğini açar.
 *
 * İKON: Gauge (gösterge). Modalın kahramanı bir SKOR (0-100); gösterge tam olarak
 * "bir bakışta seviyen" demek. Eskiden Zap (şimşek) vardı: şimşek enerji/hız anlatır,
 * içgörü değil — ikon içeriğiyle ilgisizdi.
 * Çakışmadan da kaçınıldı: BarChart3 zaten rapor butonu, Sparkles odak sekmesi,
 * Activity ise bu düğmenin aktif hâli. Aynı ikon iki şey anlatırsa ikisi de anlamsızlaşır.
 *
 * KALDIRILAN "INSIGHT" YAZISI: 8pt idi (Apple'ın okunabilir sınırı ~11pt) ve üstüne
 * opacity 0.55 uygulanmıştı → ~2.5:1 kontrast. Yani okunmuyordu bile; yalnızca başlığı
 * kalabalıklaştırıyor ve düğmeyi dikeyde uzatıyordu. Nav bar'da ikon-altı etiket iOS'un
 * deseni de değildir — o, sekme çubuğunun desenidir.
 *
 * KALDIRILAN NOKTA: koşulsuz çiziliyordu, yani hiçbir şeye bağlı değildi. Hep yanan bir
 * bildirim noktası bilgi taşımaz; kullanıcı onu görmezden gelmeyi öğrenir. Bilgi
 * taşıyormuş gibi duran süs, süsten kötüdür.
 */
export const StatusHub = ({ onPress }: { onPress: () => void }) => {
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const isDark = colorScheme === 'dark';
  const isActive = useFocusStore(s => s.isActive);
  const tr = language === 'tr';

  return (
    <Touchable
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.wrapper}
      accessibilityRole="button"
      // Görünür yazı kaldırıldı → ekran okuyucunun tek metin kaynağı BU. Etiketsiz
      // bırakmak, yazıyı silmeyi bir erişilebilirlik gerilemesine çevirirdi.
      accessibilityLabel={tr ? 'Haftalık odak analitiği' : 'Weekly focus insights'}
      accessibilityState={{ busy: isActive }}
      accessibilityHint={
        isActive
          ? (tr ? 'Odak seansın sürüyor. Ayrıntılar için aç.' : 'Focus session running. Open for details.')
          : (tr ? 'Haftalık skorunu ve öneriyi açar.' : 'Opens your weekly score and suggestion.')
      }
    >
      <MotiView
        from={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={[styles.container, { borderColor: theme.outline }]}
      >
        <BlurView intensity={isDark ? 25 : 15} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

        <MotiView
          animate={{
            scale: isActive ? [1, 1.15, 1] : 1,
            opacity: isActive ? [0.7, 1, 0.7] : 1,
          }}
          transition={{ loop: true, duration: 2000, type: 'timing' }}
          style={styles.iconContainer}
        >
          {/*
            Nabız YALNIZCA seans sürerken atıyor — hareket burada bilgi taşıyor:
            "şu an çalışıyor". Sürekli animasyon dikkat çalar ve hiçbir şey söylemez.
          */}
          {isActive ? (
            <Activity size={ICON.md} color={theme.primary} strokeWidth={2.5} />
          ) : (
            <Gauge size={ICON.md} color={theme.onSurface} strokeWidth={2} />
          )}
        </MotiView>
      </MotiView>
    </Touchable>
  );
};

const HUB = 38;

const styles = StyleSheet.create({
  wrapper: {
    // Görsel daire 38pt; dokunma hedefi 44pt olmalı (Apple HIG).
    // Görsel boyut ≠ erişilebilir alan.
    padding: S.xs,
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: HUB,
    height: HUB,
    borderRadius: R.full,
    borderWidth: B.thin,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import React from 'react';
import { S, ICON, R, B, MIN_TOUCH, TOP_ITEM_SIZE } from '@/shared/constants/tokens';
import { StyleSheet, View, Platform } from 'react-native';
import { MotiView } from 'moti';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { Gauge, Activity } from 'lucide-react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { Touchable } from '@/shared/components/Touchable';

/**
 * Başlıktaki durum düğmesi — haftanın özetini (odak süresi, alışkanlıklar, öneri) açar.
 *
 * İKON: Gauge (gösterge) — "bir bakışta haftan". Modal artık bir skor değil ölçülen süreyi
 * gösteriyor (uydurma ağırlıklı "odak skoru" 2026-10-25'te kaldırıldı, bkz. StatusHubModal);
 * ikon aynı kaldı, modalın başlığında da tekrarlanıyor ki kullanıcı nereye geldiğini tanısın. Eskiden Zap (şimşek) vardı: şimşek enerji/hız anlatır,
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
      accessibilityLabel={tr ? 'Bu haftanın özeti' : 'This week at a glance'}
      accessibilityState={{ busy: isActive }}
      accessibilityHint={
        isActive
          ? (tr ? 'Odak seansın sürüyor. Ayrıntılar için aç.' : 'Focus session running. Open for details.')
          : (tr ? 'Haftalık odak süreni, alışkanlıklarını ve öneriyi açar.' : 'Opens your weekly focus time, habits and a suggestion.')
      }
    >
      {/*
        ANDROID'DE GÖRÜNMÜYORDU (iOS'ta görünüyordu). Soldaki profil düğmesinden iki farkı
        vardı: (1) opaklığı 0'dan başlayan giriş animasyonu — çalışmazsa düğme görünmez
        kalır; (2) bulanık katman. expo-blur 56'da Android'de gerçek blur bir BlurTargetView
        ister, projede yok → katman orada hiçbir şey katmıyor, yalnız risk. Artık giriş
        animasyonu yok; Android'de zemin profil düğmesiyle aynı opak yüzey.
      */}
      <View style={[styles.container, { borderColor: theme.outline, backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surfaceField }]}>
        {/*
          Yarıçap MALZEMEYE veriliyor, yalnız kaba değil. Yuvarlak kabın
          `overflow: 'hidden'`i bulanık/cam katmanı güvenilir biçimde kırpmıyordu;
          katman kare çiziliyor ve köşeleri dairenin içinde görünüyordu.
        */}
        {Platform.OS === 'ios' && <AppBlur material="thin" radius={HUB / 2} />}

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
      </View>
    </Touchable>
  );
};

// Başlık çubuğu öğesi — ortak ölçü (bkz. TOP_ITEM_SIZE). 38'di ve 54pt'lik eski
// çubuğa göreydi; 44pt Apple çubuğunda üst/alt yalnız 3pt bırakıyordu.
const HUB = TOP_ITEM_SIZE;

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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { F, S, ICON, R, topBarSpace } from '@/shared/constants/tokens';

/**
 * BAĞLANTI YOK GÖSTERGESİ — küresel durum, tekil işlem bildirimi DEĞİL.
 *
 * NEDEN AYRI BİR ŞEY: uygulama çevrimdışı işlemleri kuyruğa alıyor ve bazı yerlerde
 * "Çevrimdışı kaydedildi" diyor. Ama bazı yollar (ör. modlar.tsx'te görev silme)
 * SESSİZCE kuyruğa alıyor. Kullanıcı hiçbir şey görmediği için "kaydedildi mi?" diye
 * duraksıyor ya da daha kötüsü, senkronun bozuk olduğunu sanıyor.
 *
 * Tekil bildirim "bu işlem ne oldu" der; bu bant "sistem şu an hangi durumda" der.
 * İkisi birbirinin yerine geçmez — bant, kullanıcı bir şey YAPMADAN önce bilgilendirir.
 *
 * `pointerEvents="none"`: hiçbir dokunuşu yutmaz, yalnız haber verir.
 */
export const OfflineBanner = () => {
  const { isOnline } = useNetworkStore();
  const { language } = useLanguageStore();
  const insets = useSafeAreaInsets();

  return (
    <AnimatePresence>
      {!isOnline && (
        <MotiView
          pointerEvents="none"
          from={{ translateY: -16, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: -16, opacity: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          /*
            BAŞLIK ÇUBUĞUNUN ALTINDA. `insets.top + 8` idi — o, 44pt'lik başlık
            çubuğunun tam üstüne denk geliyor ve avatarı/başlığı örtüyordu.
            `topBarSpace` çubuğun gerçek yüksekliğinden türer, elle yazılmaz.
          */
          style={[styles.wrapper, { top: topBarSpace(insets.top) + S.sm }]}
        >
          <View style={styles.banner}>
            <WifiOff size={ICON.sm} color="#fff" />
            <Text style={styles.text}>
              {language === 'tr' ? 'Bağlantı kesildi' : 'Connection lost'}
            </Text>
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    backgroundColor: 'rgba(185, 28, 28, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    minHeight: 36,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderRadius: R.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontSize: F.footnote,
    fontWeight: '700',
  },
});

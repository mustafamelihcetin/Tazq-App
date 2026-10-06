import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
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
 *
 * GECİKME: kısa bir kopukluk (ağ geçişi, soğuk başlatma) bant göstermeye değmez —
 * yalnız kopukluk BU SÜREDEN uzun sürerse görünür; geri gelince hemen kaybolur.
 * Renk nötr yüzey: alarm kırmızısı yerine bilgi tonu, uygulamanın geri kalanıyla aynı dil.
 */
const SHOW_AFTER_MS = 1500;

export const OfflineBanner = () => {
  const { isOnline } = useNetworkStore();
  const { language } = useLanguageStore();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isOnline]);

  return (
    <AnimatePresence>
      {visible && (
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
          <View style={[styles.banner, { backgroundColor: theme.surfaceFloating, borderColor: theme.outline }]}>
            <WifiOff size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={[styles.text, { color: theme.onSurface }]}>
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
    borderWidth: StyleSheet.hairlineWidth,
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
    fontSize: F.footnote,
    fontWeight: '700',
  },
});

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useToastStore } from '@/shared/store/useToastStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, ICON, R, B, W, LH } from '@/shared/constants/tokens';

/**
 * TOAST — geçici bildirim kapsülü.
 *
 * ── ESKİ TASARIM NEDEN ÇALIŞMIYORDU ─────────────────────────────────────────────
 * Bildirim, ekranı boydan boya kesen DOLU ve DOYGUN bir renk şeridiydi (#34c759 yeşil,
 * #ff3b30 kırmızı). Beş ayrı sorun tek görüntüde toplanıyordu:
 *
 *  1. RENK BLOĞU BAĞIRIYORDU. "1 dakikadan kısa seanslar kaydedilmez" gibi sıradan bir
 *     bilgi, ekranın en dikkat çekici öğesi hâline geliyordu. Apple'ın dili bu değil:
 *     iOS bildirimleri NÖTR bir yüzey kullanır ve rengi yalnızca İKONDA taşır. Renk
 *     böylece hâlâ anlam taşır (yeşil/kırmızı/mavi) ama okumayı zorlaştırmaz.
 *  2. RENKLER PALETİN DIŞINDAYDI. Üç ham hex elle yazılıydı; tema değişince tepki
 *     vermiyor, ölçülmüş kontrast değerlerinin hiçbirine dahil olmuyorlardı.
 *  3. CÜMLENİN TAMAMI BOLD'DU. Tek ağırlıkta uzun bir cümle hiyerarşi kurmaz, yalnız
 *     yüksek sesle konuşur.
 *  4. HEM AKSİYON HEM ÇARPI VARDI. Dar bir şeritte üç dokunma hedefi. Üstelik çarpı
 *     gereksizdi: bildirim zaten 4 saniyede kendiliğinden kapanıyor.
 *  5. TAM GENİŞLİK ŞERİTTİ. Üç kelimelik bir mesaj için ekranı boydan boya kaplamak,
 *     mesajın önemini olduğundan büyük gösterir.
 *
 * ── YENİ TASARIM ────────────────────────────────────────────────────────────────
 * İçeriğe göre daralan, ortalanmış bir kapsül: yüzen yüzey rengi (uygulamanın diğer
 * yüzen öğeleriyle aynı jeton), saç teli çerçeve, yumuşak gölge. Renk yalnız ikonda.
 * Metin normal ağırlıkta ve tema renginde. Çarpı yok — kapsülün her yeri kapatır.
 *
 * "Kaliteli" hissi burada bulanıklık ya da parlaklıktan değil, ÖLÇÜDEN geliyor: doğru
 * form, doğru hiyerarşi, doğru hareket. Az olan daha pahalı görünür.
 */

export const Toast = () => {
  const { visible, message, type, hide, actionLabel, onAction } = useToastStore();
  const { language } = useLanguageStore();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Renk artık PALETTEN. Anlam korunuyor (başarı/hata/bilgi) ama yalnız ikonu boyuyor.
  const ACCENT = {
    error: theme.error,
    success: theme.tertiary,
    info: theme.primary,
  } as const;

  const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info } as const;

  const accent = ACCENT[type];
  const Icon = ICONS[type];

  const handleAction = () => {
    onAction?.();
    hide();
  };

  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{ translateY: 28, opacity: 0, scale: 0.94 }}
          animate={{ translateY: 0, opacity: 1, scale: 1 }}
          exit={{ translateY: 20, opacity: 0, scale: 0.96 }}
          /*
            Hafif ölçek, yalnız kayan bir şeritten daha "yerine oturmuş" hissettirir —
            bildirim ekrana itilmiş gibi değil, oradan çıkmış gibi görünür. Kalite
            hissinin geldiği yer burası; renk değil.
          */
          transition={{ type: 'spring', damping: 22, stiffness: 320, mass: 0.9 }}
          style={[styles.wrap, { bottom: insets.bottom + 100 }]}
          pointerEvents="box-none"
        >
          <Touchable
            onPress={hide}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={language === 'tr' ? 'Bildirimi kapat' : 'Dismiss notification'}
            style={[
              styles.capsule,
              {
                backgroundColor: theme.surfaceFloating,
                borderColor: theme.outline,
              },
            ]}
          >
            <Icon size={ICON.sm} color={accent} strokeWidth={2.4} />

            {/*
              `flexShrink` var ama `flex: 1` YOK: kapsül içeriği kadar geniş olsun,
              kısa mesajda ekranı boydan boya kaplamasın. Uzun mesajda ise metin
              daralıp iki satıra sarabilsin.
            */}
            <Text
              style={[styles.text, { color: theme.onSurface }]}
              numberOfLines={2}
            >
              {message}
            </Text>

            {actionLabel && onAction && (
              <>
                {/*
                  Aksiyon DOLU BİR HAP DEĞİL, metin düğmesi. Dolgu, bildirimin içinde
                  ikinci bir renk bloğu daha kurardı; saç teli ayıraç aynı ayrımı
                  gürültüsüz yapıyor — iOS'un uyarı düğmelerinde kullandığı yöntem.
                */}
                <View style={[styles.divider, { backgroundColor: theme.outline }]} />
                <Touchable
                  onPress={handleAction}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                >
                  <Text style={[styles.action, { color: accent }]}>{actionLabel}</Text>
                </Touchable>
              </>
            )}
          </Touchable>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: S.md,
    right: S.md,
    alignItems: 'center',
    zIndex: 9997,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.smd,
    // Tam yuvarlak: kapsül formu "geçici" der. Köşeli bir kutu kalıcı içerik gibi durur.
    borderRadius: R.full,
    borderWidth: B.thin,
    paddingVertical: S.smd,
    paddingHorizontal: S.md,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    // Eski gölge 0.2/20 idi ve dolu renkli şeridin altında bulanık bir leke gibi
    // duruyordu. Daha geniş ve daha soluk gölge, yüzeyi ezmeden yükseklik verir.
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  text: {
    fontSize: F.subhead,
    // Eskiden '700' idi — cümlenin tamamı bold. Normal ağırlık okunur, bold bağırır.
    fontWeight: W.medium,
    lineHeight: F.subhead * LH.normal,
    flexShrink: 1,
  },
  divider: {
    width: B.thin,
    alignSelf: 'stretch',
    marginVertical: S.xxs,
  },
  action: {
    fontSize: F.footnote,
    fontWeight: W.bold,
  },
});

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useToastStore } from '@/shared/store/useToastStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, ICON, R, B, W, LH, topBarSpace } from '@/shared/constants/tokens';
import Svg, { Circle } from 'react-native-svg';
import { Animated as RNAnimated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';

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
  const { visible, message, type, placement, progress, hide, actionLabel, onAction } = useToastStore();
  const fromTop = placement === 'top';
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
          from={{ translateY: fromTop ? -28 : 28, opacity: 0, scale: 0.94 }}
          animate={{ translateY: 0, opacity: 1, scale: 1 }}
          exit={{ translateY: fromTop ? -20 : 20, opacity: 0, scale: 0.96 }}
          /*
            Hafif ölçek, yalnız kayan bir şeritten daha "yerine oturmuş" hissettirir —
            bildirim ekrana itilmiş gibi değil, oradan çıkmış gibi görünür. Kalite
            hissinin geldiği yer burası; renk değil.
          */
          transition={{ type: 'spring', damping: 22, stiffness: 320, mass: 0.9 }}
          style={[styles.wrap, fromTop ? { top: topBarSpace(insets.top) + S.sm } : { bottom: insets.bottom + 100 }]}
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
            {progress != null ? <ProgressRing value={progress} color={accent} track={theme.outline} /> : <Icon size={ICON.xs} color={accent} strokeWidth={2.4} />}

            {/*
              `flexShrink` var ama `flex: 1` YOK: kapsül içeriği kadar geniş olsun,
              kısa mesajda ekranı boydan boya kaplamasın. Uzun mesajda ise metin
              daralıp iki satıra sarabilsin.
            */}
            <Text
              style={[styles.text, { color: theme.onSurface }]}
              numberOfLines={1}
              ellipsizeMode="tail"
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


const RING = 18;
const RING_STROKE = 2.4;
const RING_R = (RING - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Hedefe ilerleme halkası: 0→değer arasında yumuşakça dolar. Metin yerine görsel
 * cevap — "ne kadar yaklaşıldı" bir bakışta okunur.
 */
const ProgressRing = ({ value, color, track }: { value: number; color: string; track: string }) => {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(anim, { toValue: Math.min(Math.max(value, 0), 1), duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, anim]);
  const dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [RING_C, 0] });
  return (
    <Svg width={RING} height={RING} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={track} strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={color} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${RING_C} ${RING_C}`} strokeDashoffset={dashOffset} />
    </Svg>
  );
};
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

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
    gap: S.sm,
    // Tek satır olduğu için tam yuvarlak hap: sakin, kısa bir not. İki satıra
    // sarsaydı aynı şekil kocaman bir balona dönüşüyordu — bu yüzden metin tek satır.
    borderRadius: R.full,
    borderWidth: B.thin,
    paddingVertical: S.xs + 2,
    paddingHorizontal: S.md,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  text: {
    fontSize: F.footnote,
    fontWeight: W.semibold,
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

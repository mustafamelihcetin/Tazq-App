import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { ICON, S, R } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { haptic } from '@/shared/utils/haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  showPeekHint?: boolean;
}

// Worklet-safe: called via runOnJS so haptics fires from JS thread
function triggerLightHaptic() {
  haptic.surface();
}

export const SwipeableItem = ({ children, onDelete, disabled, showPeekHint }: Props) => {
  const { language } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  /*
    ── SATIR AÇIK MI — JS TARAFININ DA BİLMESİ GEREKİYOR ────────────────────────
    Silme düğmesinin görünürlüğü yalnız UI iş parçacığındaki `deleteOpacity` ile
    yönetiliyordu. React bunu bilmediği için düğme KAPALI satırlarda da ağaçta
    duruyordu: ekran okuyucu her görev satırından sonra bir "Sil" düğmesi daha
    okuyordu. Yani listede yirmi görev varken yirmi görünmez silme düğmesi.

    Ayrıca opaklığı sıfır olan bir düğme hâlâ dokunulabilir bir hedeftir; içerik
    onu örtüyor ama bu bir tesadüfe (çizim sırasına) bağlı.

    Durum artık JS'te de tutuluyor ve kapalıyken düğme hem dokunulmaz hem de
    erişilebilirlik ağacının dışında.
  */
  const [isOpen, setIsOpen] = React.useState(false);
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  const contextX = useSharedValue(0);

  // One-time educational peek on first render
  useEffect(() => {
    if (!showPeekHint) return;
    const timer = setTimeout(() => {
      translateX.value = withSequence(
        withTiming(-44, { duration: 380 }),
        withDelay(500, withSpring(0, { damping: 18, stiffness: 120 }))
      );
      deleteOpacity.value = withSequence(
        withTiming(1, { duration: 380 }),
        withDelay(500, withTiming(0, { duration: 300 }))
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [showPeekHint]);

  // Pan gesture runs entirely on UI thread — no JS thread involvement during drag
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    // Activate after 10px horizontal; fail (→ scroll wins) if vertical moves first
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((e) => {
      // Only allow leftward swipe
      const newX = Math.min(0, contextX.value + e.translationX);
      translateX.value = newX;
      deleteOpacity.value = Math.min(Math.abs(newX) / 80, 1);
    })
    .onEnd((e) => {
      const total = contextX.value + e.translationX;
      // velocityX in gesture handler is px/s; -500 px/s ≈ the original -0.5 px/ms threshold
      const isFastSwipe = e.velocityX < -500;
      const isOpened = total < -40;

      if (isFastSwipe || isOpened) {
        translateX.value = withSpring(-80, { damping: 15, stiffness: 100 });
        deleteOpacity.value = withTiming(1);
        runOnJS(triggerLightHaptic)();
        runOnJS(setIsOpen)(true);
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        deleteOpacity.value = withTiming(0);
        runOnJS(setIsOpen)(false);
      }
    })
    .onFinalize(() => {
      // Snap back if gesture was cancelled mid-swipe (interrupted by scroll or system gesture)
      if (translateX.value > -40 && translateX.value < 0) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        deleteOpacity.value = withTiming(0);
        runOnJS(setIsOpen)(false);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  /*
    `withSpring` BURADAN ÇIKARILDI. Animasyon stilinin içinde çağrılınca yay HER
    KAREDE yeniden kuruluyor: sürüklerken hedef değer sürekli değiştiği için yay hiç
    oturmuyor ve ikon titriyordu. Ölçek doğrudan opaklıktan türetiliyor — aynı görsel
    etki, tek ve sürekli bir değer.
  */
  const actionStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
    transform: [{ scale: 0.8 + deleteOpacity.value * 0.2 }],
  }));

  return (
    <View style={styles.container}>
      <View
        style={[StyleSheet.absoluteFill, styles.deleteZone]}
        // Kapalıyken ne dokunulur ne okunur (yukarıdaki nota bkz.).
        pointerEvents={isOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!isOpen}
        importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
      >
        <Animated.View style={actionStyle}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={language === 'tr' ? 'Sil' : 'Delete'}
            onPress={onDelete}
            // Renk PALETTEN: `#ff3b30` elle yazılıydı, yani tema değişince yerinde
            // çakılı kalıyordu. Yıkıcı eylemin rengi zaten tanımlı.
            style={[styles.deleteBtn, { backgroundColor: theme.error }]}
          >
            {/*
              GLİF RENGİ TEMAYA GÖRE. Açık temada kırmızı koyu (#B91C1C) → beyaz glif
              okunur. Koyu temada palet daha AÇIK bir kırmızı kullanıyor (#F87171) ve
              beyaz glif orada kontrastı kaybediyor; paletin `onPrimary` için yazdığı
              gerekçenin aynısı (bkz. Colors → onPrimary notu).
            */}
            <Trash2 size={ICON.lg} color={colorScheme === 'dark' ? theme.onPrimary : '#FFFFFF'} />
          </Touchable>
        </Animated.View>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', marginBottom: S.sm },
  deleteZone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: S.md,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: R.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

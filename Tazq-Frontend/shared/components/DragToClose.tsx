import React, { useRef } from 'react';
import { Animated, PanResponder, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { R, S, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  TUTAMAÇTAN AŞAĞI ÇEK → KAPAT (2026-11-01, kullanıcı: "çentikten aşağı kaymıyor, yalnız yukarı dokununca kapanıyor").
  Alt sayfalardaki tutamaç yalnız bir çizgiydi; iOS'un her sayfasında beklenen hareket yoktu. Bu kabuk sayfanın
  kendisidir: tepesindeki tutamaç bölgesinden (tam genişlik, 44 pt) sürüklenince sayfa parmağı izler; yeterince
  (90 pt) ya da hızlı çekilince kapanır, az çekilince yerine yaylanır. Yalnız tutamaç bölgesi dinler — içerideki
  kaydırma ve dokunuşlar etkilenmez. Modal içinde çalışsın diye çekirdek PanResponder (jest kökü gerektirmez).
*/
export function DragToClose({ onClose, handleColor, style, children }: {
  onClose: () => void;
  handleColor: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
    onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 90 || g.vy > 1.2) {
        Animated.timing(y, { toValue: 600, duration: 180, useNativeDriver: true }).start(() => { closeRef.current(); y.setValue(0); });
      } else {
        Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  return (
    <Animated.View style={[style, { transform: [{ translateY: y }] }]}>
      <View {...pan.panHandlers} accessible={false} importantForAccessibility="no-hide-descendants" style={styles.zone}>
        <View style={[styles.bar, { backgroundColor: handleColor }]} />
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zone: { height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginBottom: -S.sm, zIndex: 2 },
  bar: { width: 40, height: 5, borderRadius: R.full },
});

/**
 * Yalnız tutamaç: kendi giriş animasyonu olan sayfalar için (kabuğu değiştirmeden). Aşağı çekince kapatır.
 */
export function SheetGrabber({ onClose, color }: { onClose: () => void; color: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
    onPanResponderRelease: (_e, g) => { if (g.dy > 40 || g.vy > 0.8) closeRef.current(); },
  })).current;
  return (
    <View {...pan.panHandlers} accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.zone, { marginTop: -S.sm }]}>
      <View style={[styles.bar, { backgroundColor: color }]} />
    </View>
  );
}

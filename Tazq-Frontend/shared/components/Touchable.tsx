import React, { forwardRef, useRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  Animated,
  Easing,
} from 'react-native';
import { track } from '../utils/analytics';

// TouchableOpacity'yi animasyonlu sarıyoruz → Android ripple taşma bug'larına
// düşmeden, her iki platformda tutarlı görsel geri bildirim korunur.
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Touchable — app geneli dokunulabilir.
 * Basışta opacity'ye EK olarak boyuta göre ölçek (düğme 0.96, geniş yüzey 0.98; aşağıya bkz.)
 * → parmak ucunda net, native tepki. iOS + Android birebir aynı (useNativeDriver).
 */
export const Touchable = forwardRef<View, TouchableOpacityProps>((props, ref) => {
  const { style, activeOpacity, onPressIn, onPressOut, onPress, onLayout, children, ...rest } = props;
  const scale = useRef(new Animated.Value(1)).current;
  const width = useRef(0);

  const lastPressTime = useRef<number>(0);
  const clickCount = useRef<number>(0);

  /*
    BASIŞ ÖLÇEĞİ BOYUTA GÖRE (2026-10-31, better-ui "press scales to 0.96 over 150ms ease-out").
    Düğme ve hap 0.96'ya iner — parmak altında net bir tepki. Geniş yüzey (kart gövdesi, satır)
    0.98'de kalır: tam genişlikte bir kart %4 küçülünce kenarı ~7 pt içeri kayar, tepki değil
    sarsıntı gibi okunur. Devre dışı öğe hiç küçülmez. Yay yerine ease-out: hedefi aşıp geri
    dönmez (sekme yok), basış yarıda bırakılınca yeni hedefe döner.
  */
  const press = (down: boolean) => {
    const to = !down ? 1 : width.current > 0 && width.current <= 240 ? 0.96 : 0.98;
    return Animated.timing(scale, { toValue: to, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true });
  };

  const handlePress = (e: any) => {
    const now = Date.now();
    if (now - lastPressTime.current < 450) {
      clickCount.current += 1;
      if (clickCount.current >= 4) {
        track('ui_rage_click', {
          label: (props.accessibilityLabel as string) || 'unlabeled_touchable',
        });
        clickCount.current = 0; // reset
      }
    } else {
      clickCount.current = 1;
    }
    lastPressTime.current = now;
    onPress?.(e);
  };

  return (
    <AnimatedTouchable
      ref={ref}
      style={[style, { transform: [{ scale }] }]}
      activeOpacity={activeOpacity ?? 0.7}
      onPressIn={(e) => { if (!rest.disabled) press(true).start(); onPressIn?.(e); }}
      onPressOut={(e) => { press(false).start(); onPressOut?.(e); }}
      onLayout={(e) => { width.current = e.nativeEvent.layout.width; onLayout?.(e); }}
      onPress={handlePress}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
});

Touchable.displayName = 'Touchable';

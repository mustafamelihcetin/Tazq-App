import React, { forwardRef, useRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  Animated,
} from 'react-native';
import { track } from '../utils/analytics';

// TouchableOpacity'yi animasyonlu sarıyoruz → Android ripple taşma bug'larına
// düşmeden, her iki platformda tutarlı görsel geri bildirim korunur.
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Touchable — app geneli dokunulabilir.
 * Apple HIG hissi: basışta opacity'ye EK olarak çok hafif (0.98) yay-fizikli
 * scale → parmak ucunda "canlı/native" tepki. iOS + Android birebir aynı
 * (useNativeDriver spring). Backdrop gibi büyük alanlarda fark edilmeyecek
 * kadar incedir; butonlarda tatlı bir basış hissi verir.
 */
export const Touchable = forwardRef<View, TouchableOpacityProps>((props, ref) => {
  const { style, activeOpacity, onPressIn, onPressOut, onPress, children, ...rest } = props;
  const scale = useRef(new Animated.Value(1)).current;

  const lastPressTime = useRef<number>(0);
  const clickCount = useRef<number>(0);

  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, mass: 0.7, stiffness: 300, damping: 20 });

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
      onPressIn={(e) => { spring(0.98).start(); onPressIn?.(e); }}
      onPressOut={(e) => { spring(1).start(); onPressOut?.(e); }}
      onPress={handlePress}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
});

Touchable.displayName = 'Touchable';

import React, { forwardRef } from 'react';
import {
  Platform,
  TouchableOpacity,
  Pressable,
  TouchableOpacityProps,
  View,
  Animated,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Touchable = forwardRef<View, TouchableOpacityProps>((props, ref) => {
  const { style, activeOpacity, onPress, disabled, children, ...rest } = props;

  // iOS uses the standard TouchableOpacity behavior natively.
  if (Platform.OS === 'ios') {
    return (
      <TouchableOpacity
        ref={ref}
        style={style}
        activeOpacity={activeOpacity ?? 0.7}
        onPress={onPress}
        disabled={disabled}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // Android uses AnimatedPressable to ensure 100% style/flex compatibility
  // while delivering the native Material ripple effect (without double opacity feedback).
  return (
    <AnimatedPressable
      ref={ref as any}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(150, 150, 150, 0.2)', borderless: false }}
      style={style}
      {...(rest as any)}
    >
      {children}
    </AnimatedPressable>
  );
});

Touchable.displayName = 'Touchable';

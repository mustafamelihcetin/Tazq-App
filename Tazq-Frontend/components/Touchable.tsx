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

  // Use TouchableOpacity universally to avoid Android ripple overflow bugs
  // and maintain consistent visual feedback across platforms.
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
});

Touchable.displayName = 'Touchable';

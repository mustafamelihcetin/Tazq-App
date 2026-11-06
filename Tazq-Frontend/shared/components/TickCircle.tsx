import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { R, B } from '@/shared/constants/tokens';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Yolun gerçek uzunluğu ~17.4.
const TICK_LENGTH = 18;

/*
  DAİRE DOLAR, TİK ÇİZİLİR (2026-11-06). Yalnız kullanıcı işaretleyince oynar ve durur. Süre Bluesky CountWheel ile aynı aile:
  kısa, cubic out. Hareketi Azalt açıkken doğrudan son hali.
*/
export function TickCircle({ checked, size, color, ringColor, tickColor }: { checked: boolean; size: number; color: string; ringColor: string; tickColor: string }) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(checked ? 1 : 0);
  const draw = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const to = checked ? 1 : 0;
    if (reduce) { fill.value = to; draw.value = to; return; }
    const ease = Easing.out(Easing.cubic);
    fill.value = withTiming(to, { duration: 200, easing: ease });
    draw.value = checked ? withDelay(90, withTiming(1, { duration: 220, easing: ease })) : withTiming(0, { duration: 120 });
  }, [checked, reduce, fill, draw]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.6 + 0.4 * fill.value }] }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK_LENGTH * (1 - draw.value), opacity: draw.value > 0.02 ? 1 : 0 }));

  return (
    <View style={{ width: size, height: size, borderRadius: R.full, borderWidth: B.medium, borderColor: checked ? color : ringColor, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', top: -B.medium, left: -B.medium, width: size, height: size, borderRadius: R.full, backgroundColor: color }, fillStyle]} />
      {/* İşaretsizken tik hiç çizilmez: yuvarlak uçlu boş çizgi iOS'ta dairenin içinde nokta bırakıyordu (2026-11-06, cihazda). */}
      {checked && (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <AnimatedPath d="M6 12.5l4.2 4.2L18 8.5" stroke={tickColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[TICK_LENGTH, TICK_LENGTH + 4]} animatedProps={tickProps} />
        </Svg>
      )}
    </View>
  );
}

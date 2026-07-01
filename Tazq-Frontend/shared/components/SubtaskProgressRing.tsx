import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, withSpring } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SubtaskProgressRingProps {
  total: number;
  completed: number;
  size?: number;
  strokeWidth?: number;
  activeColor: string;
  inactiveColor: string;
}

export const SubtaskProgressRing: React.FC<SubtaskProgressRingProps> = ({
  total,
  completed,
  size = 44,
  strokeWidth = 2,
  activeColor,
  inactiveColor,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const progress = total > 0 ? completed / total : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: withSpring(strokeDashoffset, { damping: 15, stiffness: 100 }),
  }));

  if (total === 0) return null;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'absolute' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeOpacity={0.2}
        />
        {/* Active Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

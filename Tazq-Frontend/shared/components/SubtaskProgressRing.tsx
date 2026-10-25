import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { useTween } from '@/shared/hooks/useTween';


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
  // Dolum JS'te ilerler, düz prop olarak çizilir (bkz. useTween — animatedProps yeniden
  // çizimde ilk değerine dönüyordu, cihazda görüldü).
  const reduceMotion = useReducedMotion();
  const shown = useTween(progress, { duration: 320, reduceMotion });
  const strokeDashoffset = circumference * (1 - shown);

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
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

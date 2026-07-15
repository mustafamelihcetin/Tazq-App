import React from 'react';
import { View, Text } from 'react-native';
import { Coffee, Flame, CheckCircle2 } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';

export interface HabitBubbleProps {
  item: any;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const HabitBubble = React.memo<HabitBubbleProps>(({ item, theme, isDark, tr, onPress, onLongPress }) => {
  const streakVal = item.streak || 0;
  const size = 50;
  const isCompleted = item.isCompleted;
  const isSkipped = item.isSkipped;

  // Flat styling:
  // 1. The outer circle border is ALWAYS a quiet neutral color (borderını boyamıyoruz).
  // 2. Completed state uses a soft mode-colored background tint (flat).
  // 3. The icon and the badges are painted in the solid mode's color.

  const bgColor = isCompleted
    ? item.color + (isDark ? '24' : '15') // soft flat tint matching the mode's color
    : isSkipped
    ? (isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)')
    : 'transparent';

  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.06)';

  const iconColor = isCompleted
    ? item.color // icon is solid mode color!
    : isSkipped
    ? '#d97706'
    : isDark
    ? 'rgba(255, 255, 255, 0.45)' // quiet neutral icon when pending
    : 'rgba(0, 0, 0, 0.4)';

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={{ alignItems: 'center', width: 62, gap: 6 }}
    >
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        borderWidth: 1.5,
        borderColor: borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isSkipped ? (
          <Coffee size={18} color="#d97706" />
        ) : (
          renderModeEmojiIcon(item.emoji ?? '📌', 20, iconColor)
        )}

        {streakVal >= 3 && !isSkipped && (
          <View style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            backgroundColor: item.color, // flame badge colored matching the mode's color!
            borderRadius: 7,
            paddingHorizontal: 4,
            paddingVertical: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
          }}>
            <Flame size={8} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#FFFFFF', marginLeft: 1 }}>{streakVal}</Text>
          </View>
        )}

        {isCompleted && (
          <View style={{
            position: 'absolute',
            top: -2,
            right: -2,
            backgroundColor: item.color, // checkmark badge colored matching the mode's color!
            borderRadius: 6.5,
            width: 13,
            height: 13,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
          }}>
            <CheckCircle2 size={9} color="#FFFFFF" />
          </View>
        )}
      </View>

      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          color: isCompleted ? theme.onSurfaceVariant : theme.onSurface,
          textAlign: 'center',
          textDecorationLine: isCompleted ? 'line-through' : 'none',
          opacity: isCompleted ? 0.55 : 0.8,
          width: '100%',
        }}
        numberOfLines={1}
      >
        {item.title}
      </Text>
    </Touchable>
  );
});

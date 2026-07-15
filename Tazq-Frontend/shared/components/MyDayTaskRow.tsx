import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, F } from '@/shared/constants/tokens';
import { getModeInfoForTask, getTaskRemainingTime } from '@/features/modes';
import { getLocalizedTaskTitle } from '@/features/tasks';
import type { AppTheme } from '@/shared/constants/Colors';

export interface MyDayTaskRowProps {
  item: any;
  isLast: boolean;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  priorityColor: (p: string) => string;
  prefs: any;
}

export const MyDayTaskRow = React.memo<MyDayTaskRowProps>(({ item, isLast, theme, isDark, tr, onPress, priorityColor, prefs }) => {
  const modeInfo = getModeInfoForTask(item.original, prefs, theme);
  return (
    <Touchable
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.md, paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        backgroundColor: modeInfo ? (isDark ? modeInfo.color + '0B' : modeInfo.color + '04') : 'transparent'
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: modeInfo ? modeInfo.color : priorityColor(item.priority), marginRight: S.md }} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <Text style={{
            fontSize: F.body,
            fontWeight: '600',
            color: item.isCompleted ? theme.onSurfaceVariant : theme.onSurface,
            textDecorationLine: item.isCompleted ? 'line-through' : 'none',
            opacity: item.isCompleted ? 0.5 : 1,
            flexShrink: 1
          }} numberOfLines={1}>
            {getLocalizedTaskTitle(item.original || item, tr)}
          </Text>
          {modeInfo && (
            <View style={{
              backgroundColor: modeInfo.color + (isDark ? '24' : '15'),
              borderRadius: 6,
              paddingHorizontal: 5,
              paddingVertical: 1.5,
              borderWidth: 0.5,
              borderColor: modeInfo.color + '40'
            }}>
              <Text style={{
                fontSize: 7.5,
                fontWeight: '800',
                color: modeInfo.color,
                letterSpacing: 0.4
              }}>
                {(tr ? modeInfo.labelTr : modeInfo.labelEn).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        {(() => {
          const isQuitMode = modeInfo && (modeInfo.unit === 'clean_day');
          if (isQuitMode) {
            return (
              <Text style={{
                fontSize: 9,
                fontWeight: '600',
                color: theme.onSurfaceVariant,
                opacity: 0.5,
                marginTop: 0.5
              }}>
                {modeInfo.daysLeft === 0
                  ? (tr ? '1. Gün' : 'Day 1')
                  : (tr ? `Temiz: ${modeInfo.daysLeft} gün` : `Clean: ${modeInfo.daysLeft} ${modeInfo.daysLeft === 1 ? 'day' : 'days'}`)}
              </Text>
            );
          }

          const taskCountdown = getTaskRemainingTime(item.original?.dueDate, item.original?.dueTime, item.original?.isCompleted, tr);
          if (!taskCountdown) return null;

          const planCountdown = modeInfo && modeInfo.daysLeft !== undefined && modeInfo.unit === 'day'
            ? (tr ? `Hedef: ${modeInfo.daysLeft} gün` : `Goal: ${modeInfo.daysLeft} days`)
            : null;

          const displayLabel = planCountdown ? `${planCountdown} · ${taskCountdown}` : taskCountdown;
          const isOverdue = taskCountdown === 'Süresi geçti' || taskCountdown === 'Overdue';

          return (
            <Text style={{
              fontSize: 9,
              fontWeight: '600',
              color: isOverdue ? theme.error : theme.onSurfaceVariant,
              opacity: 0.5,
              marginTop: 0.5
            }}>
              {displayLabel}
            </Text>
          );
        })()}
      </View>
      {item.isCompleted ? (
        <CheckCircle2 size={14} color="#10B981" style={{ marginLeft: S.sm }} />
      ) : (
        <ChevronRight size={14} color={theme.onSurfaceVariant} opacity={0.3} style={{ marginLeft: S.sm }} />
      )}
    </Touchable>
  );
});

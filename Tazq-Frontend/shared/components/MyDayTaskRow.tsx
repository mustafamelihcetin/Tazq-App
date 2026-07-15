import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { ICON, R, S, F, HAIRLINE } from '@/shared/constants/tokens';
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
        // Dikey boşluk BİLEREK burada değil, içerik bloğunda: ayırıcı satırın alt
        // kenarına oturmalı, iç boşluğun içinde asılı kalmamalı.
        paddingLeft: S.md,
        // Zemin tonu TAM GENİŞLİK kalır — iOS satırın tamamını boyar, girintiyi
        // yalnızca ayırıcıya uygular.
        backgroundColor: modeInfo ? (isDark ? modeInfo.color + '0B' : modeInfo.color + '04') : 'transparent'
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: R.full, backgroundColor: modeInfo ? modeInfo.color : priorityColor(item.priority), marginRight: S.md }} />
      {/*
        Ayırıcı bu blokta — yani noktanın SAĞINDAN, metnin başladığı yerden başlıyor.
        Apple listelerinin imzası bu: çizgi ikonun altını boş bırakır, böylece satırlar
        tek bir grup gibi okunur. Tam genişlik çizgi web/Android deseni.
      */}
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center',
        paddingVertical: S.smd, paddingRight: S.md,
        borderBottomWidth: isLast ? 0 : HAIRLINE,
        borderBottomColor: theme.separator,
      }}>
      <View style={{ flex: 1, gap: S.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, overflow: 'hidden' }}>
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
              borderRadius: R.sm,
              paddingHorizontal: S.xs,
              paddingVertical: S.xxs,
              borderWidth: 0.5,
              borderColor: modeInfo.color + '40'
            }}>
              <Text style={{
                fontSize: 7.5,
                fontWeight: '700',
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
                color: theme.onSurfaceMuted,
                marginTop: S.xxs
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
              marginTop: S.xxs
            }}>
              {displayLabel}
            </Text>
          );
        })()}
      </View>
      {item.isCompleted ? (
        <CheckCircle2 size={ICON.sm} color={theme.success} style={{ marginLeft: S.sm }} />
      ) : (
        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.3} style={{ marginLeft: S.sm }} />
      )}
      </View>
    </Touchable>
  );
});

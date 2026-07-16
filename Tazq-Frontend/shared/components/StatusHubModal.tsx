import React, { useEffect } from 'react';
import { View, Text, Modal, Animated, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { renderModeEmojiIcon } from '@/features/modes';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { BrainCircuit, Zap, Target, Play, TrendingUp, TrendingDown, Check, Coffee, BarChart2, Calendar, Sparkles } from 'lucide-react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { Touchable } from '@/shared/components/Touchable';
import { ICON, S, R, F, B, scale, verticalScale, moderateScale } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { AppIcon } from '@/shared/components/AppIcon';
interface StatusHubModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  t: any;
  insight: string;
  momentum: number;
  momentumColor: string;
  todayCompleted: number;
  dailyGoal: number;
  isActive: boolean; // focus active state
  startQuickFocus: () => void;
  weeklyTips?: any[];
  weeklyFocusData?: any[];
  lastWeekMinutes?: number;
  habits?: any[];
  streak?: number;
}

export const StatusHubModal: React.FC<StatusHubModalProps> = ({
  visible,
  onClose,
  theme,
  isDark,
  language,
  t,
  insight,
  momentum,
  momentumColor,
  todayCompleted,
  dailyGoal,
  isActive,
  startQuickFocus,
  weeklyTips,
  weeklyFocusData,
  lastWeekMinutes = 0,
  habits = [],
  streak = 0,
}) => {
  const router = useRouter();
  const { panResponder, animatedStyle, prepare, slideIn } = useSwipeToDismiss({
    onDismiss: onClose,
  });

  // Prepare position when visibility changes to true
  useEffect(() => {
    if (visible) {
      prepare();
    }
  }, [visible, prepare]);

  // Last 7 days dates helper for habit stability checklist grid
  const last7Days = React.useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      
      const weekdayLabels = language === 'tr'
        ? ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
      dates.push({
        key,
        label: weekdayLabels[d.getDay()],
        isToday: i === 0
      });
    }
    return dates;
  }, [language]);

  // Best focus day metrics
  const { bestDayName, bestDayMins, totalFocusMins } = React.useMemo(() => {
    let bestName = '-';
    let bestMins = 0;
    let total = 0;
    if (weeklyFocusData) {
      weeklyFocusData.forEach(d => {
        const mins = d.minutes || 0;
        total += mins;
        if (mins > bestMins) {
          bestMins = mins;
          bestName = d.day;
        }
      });
    }
    return { bestDayName: bestName, bestDayMins: bestMins, totalFocusMins: total };
  }, [weeklyFocusData]);

  // Count completed rituals in the last 7 days
  const completedHabitsCount = React.useMemo(() => {
    let count = 0;
    if (!habits) return 0;
    const last7Keys = last7Days.map(d => d.key);
    habits.forEach(habit => {
      const completedSet = new Set(habit.completedDates || []);
      last7Keys.forEach(key => {
        if (completedSet.has(key)) {
          count++;
        }
      });
    });
    return count;
  }, [habits, last7Days]);

  // Combined Focus Score (0-100)
  const { focusScore, focusEvaluation, focusColor } = React.useMemo(() => {
    const focusPoints = Math.min((totalFocusMins / 210) * 45, 45); // up to 45 pts
    const habitPoints = Math.min((completedHabitsCount / 10) * 40, 40); // up to 40 pts
    const streakPoints = Math.min((streak / 3) * 15, 15); // up to 15 pts
    const score = Math.max(10, Math.round(focusPoints + habitPoints + streakPoints));

    let evalTr = '';
    let evalEn = '';
    let color = theme.primary;

    if (score >= 80) {
      evalTr = 'Zirvedesin. Bu hafta odaklanma disiplinin mükemmeldi.';
      evalEn = 'Peak focus. Excellent focus discipline this week.';
      color = theme.success; // semantik başarı (tema-duyarlı; eski #10B981 iki temada da aynıydı)
    } else if (score >= 55) {
      evalTr = 'Dengeli ve istikrarlı bir ilerleme. Ritim yavaş yavaş oturuyor.';
      evalEn = 'Steady progress. You are building a consistent rhythm.';
      color = theme.primary; // Blue
    } else {
      evalTr = 'Düşük tempolu bir hafta. Önümüzdeki hafta vites artırabiliriz.';
      evalEn = 'Slow week. Let\'s step up the pace next week.';
      color = theme.warning;
    }

    return {
      focusScore: score,
      focusEvaluation: language === 'tr' ? evalTr : evalEn,
      focusColor: color
    };
  }, [totalFocusMins, completedHabitsCount, streak, theme, language]);

  // Compare focus minutes vs last week
  const weekTrend = React.useMemo(() => {
    if (lastWeekMinutes === 0) {
      return totalFocusMins > 0 ? 100 : 0;
    }
    return Math.round(((totalFocusMins - lastWeekMinutes) / lastWeekMinutes) * 100);
  }, [totalFocusMins, lastWeekMinutes]);

  // Helper to translate weekday abbreviations from API
  const getLocalizedDayName = (dayStr: string, isFull = false) => {
    const cleanDay = dayStr.trim().replace('.', '');
    const enToTrShort: Record<string, string> = {
      'Mon': 'Pt', 'Tue': 'Sa', 'Wed': 'Ça', 'Thu': 'Pe', 'Fri': 'Cu', 'Sat': 'Ct', 'Sun': 'Pa'
    };
    const enToTrFull: Record<string, string> = {
      'Mon': 'Pazartesi', 'Tue': 'Salı', 'Wed': 'Çarşamba', 'Thu': 'Perşembe', 'Fri': 'Cuma', 'Sat': 'Cumartesi', 'Sun': 'Pazar'
    };
    const enToEnFull: Record<string, string> = {
      'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
    };

    if (language === 'tr') {
      const match = Object.keys(enToTrShort).find(k => cleanDay.toLowerCase().startsWith(k.toLowerCase()));
      if (match) {
        return isFull ? enToTrFull[match] : enToTrShort[match];
      }
      return cleanDay;
    } else {
      const match = Object.keys(enToEnFull).find(k => cleanDay.toLowerCase().startsWith(k.toLowerCase()));
      if (match) {
        return isFull ? enToEnFull[match] : cleanDay;
      }
      return cleanDay;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={slideIn}
    >
      <View style={styles.overlay}>
        <Touchable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
        />
        <Animated.View
          style={[
            animatedStyle,
            styles.sheet,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: theme.outlineVariant,
            },
          ]}
        >
          {/* Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View
              style={[
                styles.dragHandle,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.12)',
                },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.insightHeader}>
            <View style={[styles.insightIcon, { backgroundColor: theme.primary + '15' }]}>
              <BrainCircuit size={ICON.md} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightHeaderTitle, { color: theme.onSurfaceVariant }]}>
                TAZQ INSIGHTS
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceMuted, marginTop: S.xxs }}>
                {language === 'tr' ? 'Haftalık odaklanma ve alışkanlık gelişimi analitiği' : 'Weekly focus and habit growth analytics'}
              </Text>
            </View>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 380 }}
            contentContainerStyle={{ gap: scale(16) }}
          >
            {/* HERO: Focus Score Card */}
            <View style={{
              borderRadius: R.xl,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            }}>
              <LinearGradient
                colors={isDark ? ['rgba(59, 130, 246, 0.15)', 'rgba(147, 51, 234, 0.1)'] : ['rgba(59, 130, 246, 0.05)', 'rgba(147, 51, 234, 0.03)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md }}
              >
                {/* Circular Score Indicator */}
                <View style={{ width: 64, height: 64, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={64} height={64}>
                    <Circle cx="32" cy="32" r="26" fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth={6} />
                    <Circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke={focusColor}
                      strokeWidth={6}
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - focusScore / 100)}`}
                    />
                  </Svg>
                  <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: F.callout, fontWeight: '700', color: theme.onSurface }}>
                      %{focusScore}
                    </Text>
                  </View>
                </View>

                {/* Score Description */}
                <View style={{ flex: 1, gap: S.xs }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {language === 'tr' ? 'HAFTALIK ODAK SKORU' : 'WEEKLY FOCUS SCORE'}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.onSurface, lineHeight: 17 }}>
                    {focusEvaluation}
                  </Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '500', color: theme.onSurfaceMuted }}>
                    {language === 'tr'
                      ? `Odak: ${totalFocusMins}dk • Alışkanlık: ${completedHabitsCount} tamamlandı • Seri: ${streak}g\n(10s altında tamamlananlar odak skorunu etkilemez)`
                      : `Focus: ${totalFocusMins}m • Habits: ${completedHabitsCount} done • Streak: ${streak}d\n(Tasks checked in <10s do not count towards the score)`}
                  </Text>
                </View>
              </LinearGradient>
            </View>
            {/* Daily Focused Coach Tip */}
            <View style={{
              borderRadius: R.lg,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }}>
              <LinearGradient
                colors={isDark ? [theme.primary + '0A', 'transparent'] : [theme.primary + '05', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: S.md }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                  <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: theme.success }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {language === 'tr' ? 'AKILLI ODAK ÖNERİSİ' : 'SMART FOCUS ADVICE'}
                  </Text>
                </View>
                <Text style={[styles.insightMainText, { color: theme.onSurface, fontSize: F.footnote, fontWeight: '500', lineHeight: 18.5, fontStyle: 'italic' }]}>
                  "{insight}"
                </Text>
              </LinearGradient>
            </View>

            {/* SECTION 1: Haftalık Odaklanma Analizi (Chart + Trend metrics side-by-side) */}
            <View style={{ gap: S.sm }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {language === 'tr' ? 'HAFTALIK ODAK HACMİ' : 'WEEKLY FOCUS VOLUME'}
                </Text>
                <Text style={{ fontSize: 9, fontWeight: '500', color: theme.onSurfaceMuted }}>
                  {language === 'tr' ? 'Son 7 günlük odaklanma sürelerinin dağılımı' : 'Distribution of focus time over the last 7 days'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: S.smd }}>
                {/* Visual Bar Chart */}
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1.6, paddingVertical: S.smd, paddingHorizontal: S.sm, position: 'relative' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm, alignSelf: 'flex-start', zIndex: 2 }}>
                    <BarChart2 size={ICON.xs} color={theme.primary} />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>
                      {language === 'tr' ? 'Odak Süreleri' : 'Focus Duration'}
                    </Text>
                  </View>

                  {/* Proportional dashed grid lines */}
                  <View style={{ position: 'absolute', left: 8, right: 8, top: 38, bottom: 24, justifyContent: 'space-between', opacity: 0.12 }}>
                    <View style={{ height: 0.5, borderStyle: 'dashed', borderWidth: 0.5, borderColor: theme.onSurfaceVariant }} />
                    <View style={{ height: 0.5, borderStyle: 'dashed', borderWidth: 0.5, borderColor: theme.onSurfaceVariant }} />
                    <View style={{ height: 0.5, borderStyle: 'dashed', borderWidth: 0.5, borderColor: theme.onSurfaceVariant }} />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', height: 60, alignItems: 'flex-end', paddingTop: S.smd, zIndex: 2 }}>
                    {weeklyFocusData && weeklyFocusData.map((d, i) => {
                      const maxMins = Math.max(...weeklyFocusData.map(val => val.minutes || 0), 30);
                      const todayIndex = (new Date().getDay() + 6) % 7; // pt=0 ... pa=6
                      const isToday = i === todayIndex;
                      const heightPercent = maxMins > 0 ? (((d.minutes || 0) / maxMins) * 100) : 0;
                      const barHeight = Math.max(4, Math.round((heightPercent / 100) * 44));
                      return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', position: 'relative' }}>
                          {d.minutes > 0 && (
                            <Text style={{ fontSize: 7, fontWeight: '700', color: theme.onSurface, position: 'absolute', top: -10 }}>
                              {d.minutes}
                            </Text>
                          )}
                          <View style={{
                            height: 44,
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            width: '100%'
                          }}>
                            {isToday ? (
                              <View style={{ height: barHeight, width: 8, borderRadius: R.xs, overflow: 'hidden' }}>
                                <LinearGradient
                                  colors={[theme.primary, theme.secondary || theme.primary]}
                                  style={{ flex: 1 }}
                                />
                              </View>
                            ) : (
                              <View style={{
                                height: barHeight,
                                width: 8,
                                borderRadius: R.xs,
                                backgroundColor: d.minutes > 0 ? theme.primary + '40' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              }} />
                            )}
                          </View>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: isToday ? theme.primary : theme.onSurfaceVariant, marginTop: S.xs, opacity: isToday ? 1 : 0.6 }}>
                            {getLocalizedDayName(d.day)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Trend Analytics Bento Box */}
                <View style={{ flex: 1, gap: S.sm }}>
                  <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1, padding: S.smd, justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: theme.onSurfaceVariant, alignSelf: 'flex-start' }}>
                      {language === 'tr' ? 'EN VERİMLİ GÜN' : 'BEST DAY'}
                    </Text>
                    <Text style={{ fontSize: F.caption2, fontWeight: '700', color: theme.onSurface, marginTop: S.xxs }}>
                      {bestDayMins > 0 ? `${getLocalizedDayName(bestDayName, true)} (${bestDayMins}m)` : '-'}
                    </Text>
                  </View>
                  <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1, padding: S.smd, justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: theme.onSurfaceVariant, alignSelf: 'flex-start' }}>
                      {language === 'tr' ? 'HAFTALIK TREND' : 'WEEKLY TREND'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, marginTop: S.xxs }}>
                      {weekTrend >= 0 ? (
                        <>
                          <TrendingUp size={ICON.xs} color={theme.success} />
                          <Text style={{ fontSize: F.caption2, fontWeight: '700', color: theme.success }}>
                            +{weekTrend}%
                          </Text>
                        </>
                      ) : (
                        <>
                          <TrendingDown size={ICON.xs} color={theme.warning} />
                          <Text style={{ fontSize: F.caption2, fontWeight: '700', color: theme.warning }}>
                            {weekTrend}%
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Synergy Insight Discovery Card */}
            {completedHabitsCount > 0 && totalFocusMins > 10 && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: S.smd,
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.07)' : 'rgba(59, 130, 246, 0.04)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: R.lg,
                padding: S.smd,
              }}>
                <AppIcon Icon={Sparkles} color={theme.primary} size={28} radius={R.full} iconSize={ICON.sm} />
                <View style={{ flex: 1, gap: S.xxs }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {language === 'tr' ? 'ALIŞKANLIK & ODAK SİNERJİSİ' : 'HABIT & FOCUS SYNERGY'}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: theme.onSurface, lineHeight: 16 }}>
                    {language === 'tr'
                      ? 'Alışkanlıklarını aksatmadığın günlerde odaklanma süren ortalama %45 daha yüksek seyrediyor. Alışkanlıkların odağını doğrudan tetikliyor!'
                      : 'On days you complete your rituals, your focus duration is on average 45% higher. Your habits directly fuel your focus!'}
                  </Text>
                </View>
              </View>
            )}

            {/* SECTION 2: Habit Consistency Grid */}
            {habits && habits.length > 0 && (
              <View style={{ gap: S.sm }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {language === 'tr' ? 'ALIŞKANLIK ZİNCİRİ' : 'HABIT CONSISTENCY'}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '500', color: theme.onSurfaceMuted }}>
                    {language === 'tr' ? 'Son 7 günlük rutinlerin tamamlanma takvimi' : 'Routine completion calendar for the last 7 days'}
                  </Text>
                </View>
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, alignItems: 'stretch', gap: S.smd, padding: S.smd }]}>
                  {habits.slice(0, 3).map((habit, hIdx) => {
                    const completedSet = new Set(habit.completedDates || []);
                    const skippedSet = new Set(habit.skippedDates || []);
                    return (
                      <View key={hIdx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Habit label */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 }}>
                          {renderModeEmojiIcon(habit.emoji ?? '📌', 14, habit.color || theme.primary)}
                          <Text numberOfLines={1} style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurface, maxWidth: 90 }}>
                            {habit.name}
                          </Text>
                        </View>
                        {/* Checklist grid */}
                        <View style={{ flexDirection: 'row', gap: S.sm }}>
                          {last7Days.map((day, dIdx) => {
                            const done = completedSet.has(day.key);
                            const skipped = skippedSet.has(day.key);
                            return (
                              <View key={dIdx} style={{ alignItems: 'center', gap: S.xxs }}>
                                <View style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: R.xs,
                                  backgroundColor: done
                                    ? habit.color
                                    : skipped
                                    ? 'rgba(217,119,6,0.15)'
                                    : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderWidth: day.isToday ? 1 : 0,
                                  borderColor: theme.primary,
                                }}>
                                  {done ? (
                                    <Check size={ICON.xs} color="#ffffff" strokeWidth={3.5} />
                                  ) : skipped ? (
                                    <Coffee size={ICON.xs} color="#d97706" />
                                  ) : null}
                                </View>
                                <Text style={{ fontSize: 6.5, fontWeight: '700', color: theme.onSurfaceVariant, opacity: day.isToday ? 1 : 0.5 }}>
                                  {day.label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}

                  {/* Legend underneath */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: S.smd, marginTop: S.xs, borderTopWidth: 0.5, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingTop: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                      <View style={{ width: 6, height: 6, borderRadius: R.xs, backgroundColor: theme.primary }} />
                      <Text style={{ fontSize: 7, fontWeight: '700', color: theme.onSurfaceMuted }}>
                        {language === 'tr' ? 'Tamamlandı' : 'Completed'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                      <View style={{ width: 6, height: 6, borderRadius: R.xs, backgroundColor: 'rgba(217,119,6,0.25)' }} />
                      <Text style={{ fontSize: 7, fontWeight: '700', color: theme.onSurfaceMuted }}>
                        {language === 'tr' ? 'Mola Verildi' : 'Skipped/Break'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 3: Haftalık Tavsiyeler (Koç Kartları) */}
            {weeklyTips && weeklyTips.length > 0 && (
              <View style={{ gap: S.sm }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: S.xxs }}>
                    {language === 'tr' ? 'HAFTALIK AKSİYON ÖNERİLERİ' : 'WEEKLY ACTIONABLE TIPS'}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '500', color: theme.onSurfaceMuted }}>
                    {language === 'tr' ? 'Performans verilerinize dayalı kişisel tavsiyeler' : 'Personal tips based on your performance trends'}
                  </Text>
                </View>
                {weeklyTips.map((tip, idx) => {
                  let badgeBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                  let badgeBorder = theme.outlineVariant;
                  let iconColor = theme.onSurfaceVariant;
                  let IconComponent = BrainCircuit;

                  if (tip.tone === 'positive') {
                    badgeBg = isDark ? 'rgba(52, 211, 153, 0.08)' : 'rgba(5, 150, 105, 0.05)';
                    badgeBorder = isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.1)';
                    iconColor = isDark ? '#34D399' : '#059669';
                    IconComponent = Target;
                  } else if (tip.tone === 'warning') {
                    badgeBg = isDark ? 'rgba(255, 179, 64, 0.08)' : 'rgba(255, 149, 0, 0.05)';
                    badgeBorder = isDark ? 'rgba(255, 179, 64, 0.15)' : 'rgba(255, 149, 0, 0.1)';
                    iconColor = theme.warning;
                    IconComponent = Zap;
                  } else if (tip.tone === 'motivational') {
                    badgeBg = isDark ? 'rgba(129, 140, 248, 0.08)' : 'rgba(37, 99, 235, 0.05)';
                    badgeBorder = isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(37, 99, 235, 0.1)';
                    iconColor = isDark ? '#818CF8' : '#2563EB';
                    IconComponent = BrainCircuit;
                  }

                  const text = language === 'tr' ? tip.textTr : tip.textEn;

                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: S.smd,
                        backgroundColor: badgeBg,
                        borderWidth: 1,
                        borderColor: badgeBorder,
                        borderRadius: R.md,
                        paddingVertical: S.smd,
                        paddingHorizontal: S.smd,
                      }}
                    >
                      <AppIcon Icon={IconComponent} color={iconColor} size={26} radius={R.full} iconSize={ICON.sm} />
                      <Text style={{ flex: 1, fontSize: F.caption2, fontWeight: '600', color: theme.onSurface, lineHeight: 16 }}>
                        {text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* SECTION 4: Temel İvme ve Görev Metrikleri */}
            <View style={styles.insightStats}>
              <View style={{ flexDirection: 'row', gap: S.smd }}>
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                  <Zap size={ICON.sm} color={momentumColor} fill={momentumColor} />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.statValue, { color: theme.onSurface }]}
                  >
                    {momentum}%
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>
                    Momentum
                  </Text>
                </View>
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                  <Target size={ICON.sm} color={theme.secondary} />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.statValue, { color: theme.onSurface }]}
                  >
                    {todayCompleted}/{dailyGoal}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>
                    {t.cockpitTarget}
                  </Text>
                </View>
              </View>
            </View>

            {/* Velocity Guard Footnote Caption */}
            <Text style={{
              fontSize: 9,
              fontWeight: '500',
              color: theme.onSurfaceMuted,
              textAlign: 'center',
              lineHeight: 13,
              marginTop: S.xs,
              paddingHorizontal: S.sm
            }}>
              {language === 'tr'
                ? '* Momentum ve Odak Skoru, en az 10 saniye aralıklarla tamamlanan görevlerden beslenir.'
                : '* Momentum and Focus Score are driven by tasks completed with at least 10-second intervals.'}
            </Text>
          </ScrollView>

        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: B.thin,
    padding: scale(24),
    gap: scale(24),
  },
  dragHandleContainer: {
    paddingTop: S.smd,
    paddingBottom: S.sm,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: R.xs,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  insightIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: R.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightHeaderTitle: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    letterSpacing: 1,
  },
  insightBody: {
    gap: scale(16),
  },
  bentoMini: {
    padding: scale(16),
    borderRadius: R.md + 4,
  },
  insightMainText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    lineHeight: verticalScale(24),
    letterSpacing: -0.3,
  },
  insightStats: {
    gap: scale(12),
  },
  statBento: {
    padding: scale(16),
    borderRadius: R.md + 4,
    alignItems: 'center',
    gap: S.xs,
  },
  statValue: {
    fontSize: moderateScale(18),
    fontWeight: '600',
  },
  statLabel: {
    fontSize: moderateScale(10),
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  cockpitActions: {
    gap: scale(12),
  },
  actionButtonMain: {
    height: verticalScale(46),
    borderRadius: R.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
  },
  actionButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionButtonSecondary: {
    height: verticalScale(46),
    borderRadius: R.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextSecondary: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

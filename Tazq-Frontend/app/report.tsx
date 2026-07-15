import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flame, Clock, CheckCircle2, Zap, Calendar } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes';
import { useMomentumStore } from '@/features/user';
import { useHabitStore } from '@/features/habits';
import { FocusService, UserStatsResponse } from '@/shared/services/api';
import { ICON, S, R, F, B, TRACKING, MAX_W } from '@/shared/constants/tokens';
import { generateWeeklyTips, computeWeeklyMetrics, getCoachAction, ProductivityHour } from '@/shared/utils/insights';
import { track } from '@/shared/utils/analytics';
import type { AppTheme } from '@/shared/constants/Colors';

// Koç/ipucu tonlarını tema token'larına bağlar.
// Eskiden burada ayrı bir mini palet vardı (Apple HIG renkleri: #34C759, #FF9500,
// #8E8E93) — yani tema değişince bu ekran geride kalıyordu ve WCAG denetimine de
// girmiyordu. Artık tek kaynak: Colors.
const toneColor = (theme: AppTheme, tone: string): string => ({
  positive: theme.success,
  warning: theme.warning,
  motivational: theme.primary,
  neutral: theme.onSurfaceVariant,
}[tone] ?? theme.primary);

export default function ReportScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const productivityHour = usePrefsStore(s => s.productivityHour);
  const getLastNDays = useMomentumStore(s => s.getLastNDays);
  const habits = useHabitStore(s => s.habits);

  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const s = await FocusService.getStats();
      setStats(s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { track('report_opened'); load(); }, []);

  const weeklyFocus = stats?.weeklyFocus ?? [];
  const weeklyMinutes = weeklyFocus.map(d => d.minutes || 0);
  const momentumLast7 = getLastNDays(7).map(d => d.score);
  const input = {
    weeklyFocusMinutes: weeklyMinutes,
    completedTasksWeek: weeklyFocus.reduce((a, d) => a + (d.tasksCompleted || 0), 0),
    streak: stats?.activeStreak ?? 0,
    momentumLast7,
    productivityHour: productivityHour as ProductivityHour,
    habits,
  };
  const metrics = computeWeeklyMetrics(input);
  const tips = generateWeeklyTips(input, 3);
  const todayFocus = weeklyFocus[weeklyFocus.length - 1];
  const coach = getCoachAction({
    streak: input.streak,
    todayFocusMin: todayFocus?.minutes ?? 0,
    todayTasksDone: todayFocus?.tasksCompleted ?? 0,
    momentum: momentumLast7.length ? momentumLast7[momentumLast7.length - 1] : -1,
  });
  const maxMin = Math.max(1, ...weeklyMinutes);
  const totalHours = Math.floor(metrics.totalFocusMin / 60);
  const totalRemMin = metrics.totalFocusMin % 60;

  const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
      <View style={{ width: 34, height: 34, borderRadius: R.sm, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>
        {icon}
      </View>
      <Text style={{ color: theme.onSurface, fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  if (loading || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={tr ? 'Geri' : 'Back'}>
            <ArrowLeft size={ICON.lg} color={theme.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.onSurface }]}>{tr ? 'Haftalık Rapor' : 'Weekly Report'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : (
          <View style={styles.center}>
            <Text style={{ color: theme.onSurfaceVariant, marginBottom: S.md }}>{tr ? 'Rapor yüklenemedi.' : 'Could not load report.'}</Text>
            <TouchableOpacity onPress={load} style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.surfaceContainerHigh }} accessibilityRole="button" accessibilityLabel={tr ? 'Yeniden dene' : 'Retry'}>
              <Text style={{ color: theme.onSurface, fontWeight: '700' }}>{tr ? '↺ Yeniden dene' : '↺ Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.header, { justifyContent: 'flex-start', gap: S.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={tr ? 'Geri' : 'Back'}>
          <ArrowLeft size={ICON.lg} color={theme.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.onSurface }]}>{tr ? 'Haftalık Rapor' : 'Weekly Report'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.lg, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
          {/* Koç kartı — "şimdi ne yapmalıyım?" (kural-tabanlı, ücretsiz) */}
          {(() => {
            const c = toneColor(theme, coach.tone);
            return (
              <View style={[styles.coach, { backgroundColor: c + '14', borderColor: c + '33' }]}>
                <Text style={{ color: c, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.xs }}>
                  {tr ? '🧭 KOÇUN' : '🧭 YOUR COACH'}
                </Text>
                <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', lineHeight: 22 }}>
                  {tr ? coach.textTr : coach.textEn}
                </Text>
                {coach.route && (
                  <TouchableOpacity
                    onPress={() => { track('coach_tip_shown', { tone: coach.tone, route: coach.route }); router.push(coach.route as any); }}
                    style={{ alignSelf: 'flex-start', marginTop: S.sm, backgroundColor: c, paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full }}
                    accessibilityRole="button"
                    accessibilityLabel={tr ? coach.ctaTr : coach.ctaEn}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: F.caption }}>{tr ? coach.ctaTr : coach.ctaEn}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* Metric grid */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <StatCard icon={<Clock size={ICON.md} color="#6366F1" />} value={totalHours > 0 ? `${totalHours}s ${totalRemMin}d` : `${metrics.totalFocusMin}d`} label={tr ? 'Bu hafta odak' : 'Focus this week'} color="#6366F1" />
            <StatCard icon={<Flame size={ICON.md} color={theme.streak} />} value={`${input.streak}`} label={tr ? 'Gün seri' : 'Day streak'} color="#FF9500" />
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <StatCard icon={<CheckCircle2 size={ICON.md} color="#34C759" />} value={`${input.completedTasksWeek}`} label={tr ? 'Tamamlanan görev' : 'Tasks done'} color="#34C759" />
            <StatCard icon={<Zap size={ICON.md} color="#FF2D55" />} value={metrics.avgMomentum >= 0 ? `${metrics.avgMomentum}%` : '—'} label={tr ? 'Ort. momentum' : 'Avg momentum'} color="#FF2D55" />
          </View>

          {/* Weekly focus bar chart */}
          <View style={[styles.section, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.md }}>
              <Calendar size={ICON.sm} color={theme.onSurfaceVariant} />
              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Günlük odak (dk)' : 'Daily focus (min)'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 90, gap: S.sm }}>
              {weeklyMinutes.length === 0 ? (
                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Henüz veri yok.' : 'No data yet.'}</Text>
              ) : weeklyMinutes.map((min, i) => {
                const pct = Math.max((min / maxMin) * 100, 3);
                const isBest = i === metrics.bestDayIndex && min > 0;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: S.xs }}>
                    <MotiView
                      from={{ height: 2 }}
                      animate={{ height: `${pct}%` as any }}
                      transition={{ type: 'timing', duration: 500, delay: i * 60 }}
                      style={{ width: '70%', borderRadius: R.xs, backgroundColor: isBest ? theme.primary : theme.primary + '55' }}
                    />
                    <Text style={{ fontSize: 9, color: theme.onSurfaceMuted }}>{weeklyFocus[i]?.day?.slice(0, 2) ?? i + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Insights / tips */}
          <View style={{ gap: S.sm }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {tr ? 'Öneriler' : 'Insights'}
            </Text>
            {tips.map((tip, i) => {
              const c = toneColor(theme, tip.tone);
              return (
                <View key={i} style={[styles.tip, { backgroundColor: c + '12', borderLeftColor: c }]}>
                  <Text style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '500', lineHeight: 21 }}>
                    {tr ? tip.textTr : tip.textEn}
                  </Text>
                </View>
              );
            })}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: TRACKING.title },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  statCard: { flex: 1, borderRadius: R.lg, borderWidth: B.thin, padding: S.md, gap: S.xxs },
  section: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md },
  tip: { borderRadius: R.md, borderLeftWidth: 3, padding: S.md },
  coach: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
});
